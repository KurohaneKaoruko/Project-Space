import { sha256 } from 'js-sha256';

export function getTimesalt(loopcount: number) {
    const timesaltkey = process.env.GAME_2048_TIMESALT_KEY || '';
    const timesalt = Math.floor(new Date().getTime() / 300000);
    const secretKey = sha256(timesaltkey + sha256(String(timesalt)));

    let salt = '';
    for (let i = 0; i < loopcount; i++) {
        salt = sha256(salt + secretKey);
    }

    return salt;
}

