import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  redirectToYoutube(@Res() res: Response) {
    const url = this.appService.getRedirectUrl();
    return res.redirect(url);
  }
}
