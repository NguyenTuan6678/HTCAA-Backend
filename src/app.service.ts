import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRedirectUrl(): string {
    return 'https://youtu.be/dQw4w9WgXcQ?si=ErbTfdLufAIS0Mzl';
  }
}
