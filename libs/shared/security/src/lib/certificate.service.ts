import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/database';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as forge from 'node-forge';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface CertificateData {
  id: string;
  serialNumber: string;
  commonName: string;
  organizationId: number;
  certificatePem: string;
  privateKeyPem: string;
  publicKeyPem: string;
  issuerDn: string;
  subjectDn: string;
  validFrom: Date;
  validTo: Date;
  isActive: boolean;
  isRevoked: boolean;
  createdAt: Date;
}

export interface CertificateGenerationOptions {
  commonName: string;
  organizationId: number;
  validityDays?: number;
  keySize?: number;
  subjectAltNames?: string[];
}

export interface CertificateRenewalResult {
  oldCertId: string;
  newCertId: string;
  certificatePem: string;
  privateKeyPem: string;
  validTo: Date;
  renewalId: string;
}

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);
  private readonly defaultValidityDays = 365;
  private readonly defaultKeySize = 2048;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generateCertificate(options: CertificateGenerationOptions): Promise<CertificateData> {
    this.logger.log(`Generating certificate for ${options.commonName}`);

    const keySize = options.keySize || this.defaultKeySize;
    const validityDays = options.validityDays || this.defaultValidityDays;

    // Generate key pair
    const keyPair = forge.pki.rsa.generateKeyPair(keySize);
    const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);
    const publicKeyPem = forge.pki.publicKeyToPem(keyPair.publicKey);

    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keyPair.publicKey;
    cert.serialNumber = this.generateSerialNumber();

    // Set validity period
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + validityDays);
    
    cert.validity.notBefore = validFrom;
    cert.validity.notAfter = validTo;

    // Set subject
    const subject = [
      { name: 'commonName', value: options.commonName },
      { name: 'organizationName', value: `Organization-${options.organizationId}` },
      { name: 'countryName', value: 'US' },
    ];
    cert.setSubject(subject);

    // Set issuer (self-signed for now, can be updated for CA integration)
    cert.setIssuer(subject);

    // Add extensions
    const extensions = [
      {
        name: 'basicConstraints',
        cA: false,
      },
      {
        name: 'keyUsage',
        keyCertSign: false,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true,
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
      },
    ];

    // Add Subject Alternative Names if provided
    if (options.subjectAltNames && options.subjectAltNames.length > 0) {
      extensions.push({
        name: 'subjectAltName',
        altNames: options.subjectAltNames.map(name => ({
          type: 2, // DNS name
          value: name,
        })),
      });
    }

    cert.setExtensions(extensions);

    // Sign certificate
    cert.sign(keyPair.privateKey, forge.md.sha256.create());

    const certificatePem = forge.pki.certificateToPem(cert);
    const subjectDn = cert.subject.attributes.map(attr => `${attr.name}=${attr.value}`).join(', ');
    const issuerDn = cert.issuer.attributes.map(attr => `${attr.name}=${attr.value}`).join(', ');

    // Store certificate in database
    const certData = await this.prisma.certificate.create({
      data: {
        serialNumber: cert.serialNumber,
        commonName: options.commonName,
        organizationId: options.organizationId,
        certificatePem,
        privateKeyPem,
        publicKeyPem,
        issuerDn,
        subjectDn,
        validFrom,
        validTo,
        isActive: true,
        isRevoked: false,
      },
    });

    // Log certificate generation
    await this.logCertificateActivity('GENERATE', certData.id, options.organizationId, {
      commonName: options.commonName,
      validTo,
      serialNumber: cert.serialNumber,
    });

    this.logger.log(`Certificate generated successfully: ${certData.id}`);

    return {
      id: certData.id,
      serialNumber: certData.serialNumber,
      commonName: certData.commonName,
      organizationId: certData.organizationId,
      certificatePem: certData.certificatePem,
      privateKeyPem: certData.privateKeyPem,
      publicKeyPem: certData.publicKeyPem,
      issuerDn: certData.issuerDn,
      subjectDn: certData.subjectDn,
      validFrom: certData.validFrom,
      validTo: certData.validTo,
      isActive: certData.isActive,
      isRevoked: certData.isRevoked,
      createdAt: certData.createdAt,
    };
  }

  private generateSerialNumber(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  async validateCertificate(certificatePem: string): Promise<{
    isValid: boolean;
    errors: string[];
    expiresAt?: Date;
  }> {
    const errors: string[] = [];

    try {
      const cert = forge.pki.certificateFromPem(certificatePem);
      const now = new Date();

      // Check validity period
      if (cert.validity.notBefore > now) {
        errors.push('Certificate is not yet valid');
      }

      if (cert.validity.notAfter < now) {
        errors.push('Certificate has expired');
      }

      // Check if certificate is revoked
      const storedCert = await this.prisma.certificate.findFirst({
        where: { serialNumber: cert.serialNumber },
      });

      if (storedCert?.isRevoked) {
        errors.push('Certificate has been revoked');
      }

      // Verify certificate chain (simplified - in production, verify against CA)
      try {
        const caStore = forge.pki.createCaStore();
        caStore.addCertificate(cert); // Self-signed for now
        
        const verified = forge.pki.verifyCertificateChain(caStore, [cert]);
        if (!verified) {
          errors.push('Certificate chain verification failed');
        }
      } catch (error) {
        errors.push(`Certificate verification error: ${error.message}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        expiresAt: cert.validity.notAfter,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Invalid certificate format: ${error.message}`],
      };
    }
  }

  async renewCertificate(certificateId: string): Promise<CertificateRenewalResult> {
    this.logger.log(`Starting certificate renewal for: ${certificateId}`);

    const existingCert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
    });

    if (!existingCert) {
      throw new Error(`Certificate not found: ${certificateId}`);
    }

    const renewalId = crypto.randomUUID();

    // Generate new certificate with same parameters
    const newCert = await this.generateCertificate({
      commonName: existingCert.commonName,
      organizationId: existingCert.organizationId,
      validityDays: this.defaultValidityDays,
    });

    // Start staged rollout process
    await this.prisma.$transaction(async (tx) => {
      // Mark old certificate for renewal
      await tx.certificate.update({
        where: { id: certificateId },
        data: {
          renewalId,
          renewalStartedAt: new Date(),
        },
      });

      // Log renewal activity
      await this.logCertificateActivity('RENEW_START', certificateId, existingCert.organizationId, {
        newCertId: newCert.id,
        renewalId,
      });
    });

    // Schedule old certificate deactivation after verification
    this.scheduleOldCertificateDeactivation(certificateId, renewalId);

    this.logger.log(`Certificate renewal completed: ${certificateId} -> ${newCert.id}`);

    return {
      oldCertId: certificateId,
      newCertId: newCert.id,
      certificatePem: newCert.certificatePem,
      privateKeyPem: newCert.privateKeyPem,
      validTo: newCert.validTo,
      renewalId,
    };
  }

  private scheduleOldCertificateDeactivation(certId: string, renewalId: string): void {
    const gracePeriodMs = this.config.get('CERT_RENEWAL_GRACE_PERIOD_HOURS', 24) * 60 * 60 * 1000;

    setTimeout(async () => {
      try {
        await this.prisma.certificate.update({
          where: { id: certId, renewalId },
          data: { 
            isActive: false, 
            renewalCompletedAt: new Date(),
          },
        });

        await this.logCertificateActivity('RENEW_COMPLETE', certId, null, { renewalId });

        this.logger.log(`Certificate deactivated after grace period: ${certId}`);
      } catch (error) {
        this.logger.error(`Failed to deactivate renewed certificate ${certId}: ${error.message}`);
      }
    }, gracePeriodMs);
  }

  async revokeCertificate(certificateId: string, reason?: string): Promise<void> {
    this.logger.log(`Revoking certificate: ${certificateId}`);

    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
    });

    if (!cert) {
      throw new Error(`Certificate not found: ${certificateId}`);
    }

    await this.prisma.certificate.update({
      where: { id: certificateId },
      data: {
        isRevoked: true,
        isActive: false,
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });

    await this.logCertificateActivity('REVOKE', certificateId, cert.organizationId, { reason });

    this.logger.log(`Certificate revoked: ${certificateId}`);
  }

  async getExpiringCertificates(daysUntilExpiry: number = 30): Promise<CertificateData[]> {
    const expiryThreshold = new Date();
    expiryThreshold.setDate(expiryThreshold.getDate() + daysUntilExpiry);

    const certs = await this.prisma.certificate.findMany({
      where: {
        isActive: true,
        isRevoked: false,
        validTo: {
          lte: expiryThreshold,
        },
      },
    });

    return certs.map(cert => ({
      id: cert.id,
      serialNumber: cert.serialNumber,
      commonName: cert.commonName,
      organizationId: cert.organizationId,
      certificatePem: cert.certificatePem,
      privateKeyPem: cert.privateKeyPem,
      publicKeyPem: cert.publicKeyPem,
      issuerDn: cert.issuerDn,
      subjectDn: cert.subjectDn,
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      isActive: cert.isActive,
      isRevoked: cert.isRevoked,
      createdAt: cert.createdAt,
    }));
  }

  async distributeCertificateToGateway(certificateId: string, gatewayId: string): Promise<void> {
    this.logger.log(`Distributing certificate ${certificateId} to gateway ${gatewayId}`);

    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
    });

    if (!cert) {
      throw new Error(`Certificate not found: ${certificateId}`);
    }

    // Store certificate files in secure location for gateway access
    const certDir = path.join(this.config.get('CERT_STORAGE_PATH', '/etc/ssl/certs'), gatewayId);
    
    try {
      await fs.mkdir(certDir, { recursive: true });
      
      await fs.writeFile(
        path.join(certDir, 'cert.pem'),
        cert.certificatePem,
        { mode: 0o600 }
      );
      
      await fs.writeFile(
        path.join(certDir, 'key.pem'),
        cert.privateKeyPem,
        { mode: 0o600 }
      );

      // Update certificate distribution record
      await this.prisma.certificateDistribution.create({
        data: {
          certificateId,
          gatewayId,
          distributedAt: new Date(),
          status: 'DISTRIBUTED',
        },
      });

      await this.logCertificateActivity('DISTRIBUTE', certificateId, cert.organizationId, {
        gatewayId,
        distributionPath: certDir,
      });

      this.logger.log(`Certificate distributed successfully to gateway ${gatewayId}`);
    } catch (error) {
      this.logger.error(`Failed to distribute certificate: ${error.message}`);
      throw error;
    }
  }

  async scheduleAutomaticRenewal(): Promise<void> {
    this.logger.log('Starting automatic certificate renewal check');

    const expiringCerts = await this.getExpiringCertificates(30); // 30 days before expiry

    for (const cert of expiringCerts) {
      try {
        await this.renewCertificate(cert.id);
        this.logger.log(`Automatically renewed expiring certificate: ${cert.id}`);
      } catch (error) {
        this.logger.error(`Failed to auto-renew certificate ${cert.id}: ${error.message}`);
      }
    }
  }

  private async logCertificateActivity(
    action: string,
    certificateId: string,
    organizationId: number | null,
    metadata: any = {},
  ): Promise<void> {
    try {
      await this.prisma.certificateAuditLog.create({
        data: {
          action,
          certificateId,
          organizationId,
          metadata: JSON.stringify(metadata),
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log certificate activity: ${error.message}`);
    }
  }
}