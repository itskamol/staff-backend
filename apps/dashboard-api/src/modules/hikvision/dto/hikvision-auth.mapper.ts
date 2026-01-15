import { AuthMode } from './auth-mode.enum';

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
