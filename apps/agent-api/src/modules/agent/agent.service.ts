import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { ValidationUtil, EncryptionUtil } from '@app/shared/utils';
import {
    ActiveWindowDto,
    VisitedSiteDto,
    ScreenshotDto,
    UserSessionDto,
    RegisterComputerDto,
    RegisterComputerUserDto,
} from './dto/agent.dto';

@Injectable()
export class AgentService {
    private readonly logger = new Logger(AgentService.name);

    constructor(private readonly prisma: PrismaService) {}

    private async validateApiKey(apiKey: string): Promise<boolean> {
        if (!apiKey) {
            throw new UnauthorizedException('API key is required');
        }

        // In a real implementation, you would validate against stored API keys
        // For now, we'll use a simple validation
        const hashedKey = EncryptionUtil.hashApiKey(apiKey);

        // TODO: Check against database or environment variable
        // For development, accept any non-empty key
        return apiKey.length > 0;
    }

    private async findOrCreateComputer(computerUid: string): Promise<number> {
        let computer = await this.prisma.computer.findUnique({
            where: { computerUid },
        });

        if (!computer) {
            computer = await this.prisma.computer.create({
                data: {
                    computerUid,
                    os: null,
                    ipAddress: null,
                    macAddress: null,
                },
            });
            this.logger.log(`Created new computer: ${computerUid}`);
        }

        return computer.id;
    }

    private async findOrCreateComputerUser(userSid: string): Promise<number> {
        let computerUser = await this.prisma.computerUser.findUnique({
            where: { sid: userSid },
        });

        if (!computerUser) {
            // Create a placeholder computer user
            computerUser = await this.prisma.computerUser.create({
                data: {
                    employeeId: null, // Will be linked later
                    sid: userSid,
                    name: 'Unknown User',
                    domain: null,
                    username: userSid,
                    isAdmin: false,
                    isInDomain: false,
                },
            });
            this.logger.log(`Created new computer user: ${userSid}`);
        }

        return computerUser.id;
    }

    private async findOrCreateUsersOnComputers(
        computerUserId: number,
        computerId: number
    ): Promise<number> {
        let usersOnComputers = await this.prisma.usersOnComputers.findFirst({
            where: {
                computerUserId,
                computerId,
            },
        });

        if (!usersOnComputers) {
            usersOnComputers = await this.prisma.usersOnComputers.create({
                data: {
                    computerUserId,
                    computerId,
                },
            });
            this.logger.log(
                `Created new users on computers relation: ${computerUserId} - ${computerId}`
            );
        }

        return usersOnComputers.id;
    }

    async registerComputer(registerComputerDto: RegisterComputerDto, apiKey: string) {
        await this.validateApiKey(apiKey);

        const { computerUid, os, ipAddress, macAddress } = registerComputerDto;

        const computer = await this.prisma.computer.upsert({
            where: { computerUid },
            update: {
                os,
                ipAddress,
                macAddress,
            },
            create: {
                computerUid,
                os,
                ipAddress,
                macAddress,
            },
        });

        this.logger.log(`Computer registered/updated: ${computerUid}`);
        return computer;
    }

    async registerComputerUser(registerComputerUserDto: RegisterComputerUserDto, apiKey: string) {
        await this.validateApiKey(apiKey);

        const { sid, name, domain, username, isAdmin, isInDomain } = registerComputerUserDto;

        const computerUser = await this.prisma.computerUser.upsert({
            where: { sid },
            update: {
                name,
                domain,
                username,
                isAdmin,
                isInDomain,
            },
            create: {
                employeeId: null, // Will be linked later
                sid,
                name,
                domain,
                username,
                isAdmin,
                isInDomain,
            },
        });

        this.logger.log(`Computer user registered/updated: ${sid}`);
        return computerUser;
    }

    async processActiveWindows(activeWindowDto: ActiveWindowDto, apiKey: string) {
        await this.validateApiKey(apiKey);
        ValidationUtil.validateAgentData(activeWindowDto);

        const { computerUid, userSid, data } = activeWindowDto;

        try {
            // Find or create related entities
            const computerId = await this.findOrCreateComputer(computerUid);
            const computerUserId = await this.findOrCreateComputerUser(userSid);
            const usersOnComputersId = await this.findOrCreateUsersOnComputers(
                computerUserId,
                computerId
            );

            // Process each active window record
            const activeWindows = Array.isArray(data) ? data : [data];

            for (const window of activeWindows) {
                await this.prisma.activeWindow.create({
                    data: {
                        usersOnComputersId,
                        datetime: new Date(window.datetime),
                        title: window.title,
                        processName: window.processName,
                        icon: window.icon || null,
                        activeTime: window.activeTime,
                    },
                });
            }

            this.logger.log(
                `Processed ${activeWindows.length} active window records for ${computerUid}/${userSid}`
            );
        } catch (error) {
            this.logger.error(`Error processing active windows: ${error.message}`, error.stack);
            throw new BadRequestException('Failed to process active windows data');
        }
    }

    async processVisitedSites(visitedSiteDto: VisitedSiteDto, apiKey: string) {
        await this.validateApiKey(apiKey);
        ValidationUtil.validateAgentData(visitedSiteDto);

        const { computerUid, userSid, data } = visitedSiteDto;

        try {
            // Find or create related entities
            const computerId = await this.findOrCreateComputer(computerUid);
            const computerUserId = await this.findOrCreateComputerUser(userSid);
            const usersOnComputersId = await this.findOrCreateUsersOnComputers(
                computerUserId,
                computerId
            );

            // Process each visited site record
            const visitedSites = Array.isArray(data) ? data : [data];

            for (const site of visitedSites) {
                await this.prisma.visitedSite.create({
                    data: {
                        usersOnComputersId,
                        datetime: new Date(site.datetime),
                        title: site.title || null,
                        url: site.url,
                        processName: site.processName,
                        icon: site.icon || null,
                        activeTime: site.activeTime,
                    },
                });
            }

            this.logger.log(
                `Processed ${visitedSites.length} visited site records for ${computerUid}/${userSid}`
            );
        } catch (error) {
            this.logger.error(`Error processing visited sites: ${error.message}`, error.stack);
            throw new BadRequestException('Failed to process visited sites data');
        }
    }

    async processScreenshots(screenshotDto: ScreenshotDto, apiKey: string) {
        await this.validateApiKey(apiKey);
        ValidationUtil.validateAgentData(screenshotDto);

        const { computerUid, userSid, data } = screenshotDto;

        try {
            // Find or create related entities
            const computerId = await this.findOrCreateComputer(computerUid);
            const computerUserId = await this.findOrCreateComputerUser(userSid);
            const usersOnComputersId = await this.findOrCreateUsersOnComputers(
                computerUserId,
                computerId
            );

            // Process each screenshot record
            const screenshots = Array.isArray(data) ? data : [data];

            for (const screenshot of screenshots) {
                await this.prisma.screenshot.create({
                    data: {
                        usersOnComputersId,
                        datetime: new Date(screenshot.datetime),
                        title: screenshot.title || null,
                        filePath: screenshot.filePath,
                        processName: screenshot.processName,
                        icon: screenshot.icon || null,
                    },
                });
            }

            this.logger.log(
                `Processed ${screenshots.length} screenshot records for ${computerUid}/${userSid}`
            );
        } catch (error) {
            this.logger.error(`Error processing screenshots: ${error.message}`, error.stack);
            throw new BadRequestException('Failed to process screenshots data');
        }
    }

    async processUserSessions(userSessionDto: UserSessionDto, apiKey: string) {
        await this.validateApiKey(apiKey);
        ValidationUtil.validateAgentData(userSessionDto);

        const { computerUid, userSid, data } = userSessionDto;

        try {
            // Find or create related entities
            const computerId = await this.findOrCreateComputer(computerUid);
            const computerUserId = await this.findOrCreateComputerUser(userSid);
            const usersOnComputersId = await this.findOrCreateUsersOnComputers(
                computerUserId,
                computerId
            );

            // Process each user session record
            const userSessions = Array.isArray(data) ? data : [data];

            for (const session of userSessions) {
                await this.prisma.userSession.create({
                    data: {
                        usersOnComputersId,
                        startTime: new Date(session.startTime),
                        endTime: session.endTime ? new Date(session.endTime) : null,
                        sessionType: session.sessionType,
                    },
                });
            }

            this.logger.log(
                `Processed ${userSessions.length} user session records for ${computerUid}/${userSid}`
            );
        } catch (error) {
            this.logger.error(`Error processing user sessions: ${error.message}`, error.stack);
            throw new BadRequestException('Failed to process user sessions data');
        }
    }
}
