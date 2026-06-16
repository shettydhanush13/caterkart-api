import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './admins.dto';
import { Staff } from '../auth/decorators';

@Staff()
@Controller('admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  list() {
    return this.admins.list();
  }

  @Get('is-admin/:phone')
  async isAdmin(@Param('phone') phone: string) {
    return { isAdmin: await this.admins.isAdmin(phone) };
  }

  @Get('profile/:phone')
  profile(@Param('phone') phone: string) {
    return this.admins.profile(phone);
  }

  @Post()
  create(@Body() body: CreateAdminDto) {
    return this.admins.create(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.admins.remove(id);
  }
}
