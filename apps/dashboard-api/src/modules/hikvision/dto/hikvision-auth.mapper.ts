import { AuthMode } from '@prisma/client';

export function mapAuthModeToHikvision(mode: AuthMode): string {
    switch (mode) {
        case AuthMode.CARD_AND_PASSWORD:
            return 'cardAndPw';

        case AuthMode.CARD:
            return 'card';

        case AuthMode.FINGERPRINT:
            return 'fp';

        case AuthMode.FINGERPRINT_OR_CARD:
            return 'fpOrCard';

        case AuthMode.FINGERPRINT_AND_CARD:
            return 'fpAndCard';

        case AuthMode.FACE_AND_PASSWORD:
            return 'faceAndPw';

        case AuthMode.FACE_AND_CARD:
            return 'faceAndCard';

        case AuthMode.FACE:
            return 'face';

        case AuthMode.CARD_OR_FACE_OR_PASSWORD:
            return 'cardOrfaceOrPw';

        case AuthMode.CARD_OR_FACE:
            return 'cardOrFace';

        case AuthMode.CARD_OR_FINGERPRINT_OR_PASSWORD:
            return 'cardOrFpOrPw';
        default:
            throw new Error(`Unsupported auth mode: ${mode}`);
    }
}

export function mapHikvisionVerifyModeToAuthMode(verifyMode?: string): AuthMode | null {
    switch (verifyMode) {
        case 'cardAndPw':
            return AuthMode.CARD_AND_PASSWORD;

        case 'card':
            return AuthMode.CARD;

        case 'fp':
            return AuthMode.FINGERPRINT;

        case 'fpOrCard':
            return AuthMode.FINGERPRINT_OR_CARD;

        case 'fpAndCard':
            return AuthMode.FINGERPRINT_AND_CARD;

        case 'faceAndPw':
            return AuthMode.FACE_AND_PASSWORD;

        case 'faceAndCard':
            return AuthMode.FACE_AND_CARD;

        case 'face':
            return AuthMode.FACE;

        case 'cardOrfaceOrPw':
            return AuthMode.CARD_OR_FACE_OR_PASSWORD;

        case 'cardOrFace':
            return AuthMode.CARD_OR_FACE;

        case 'cardOrFpOrPw':
            return AuthMode.CARD_OR_FINGERPRINT_OR_PASSWORD;

        default:
            return null; // nomaʼlum yoki device qo‘llamagan mode
    }
}
