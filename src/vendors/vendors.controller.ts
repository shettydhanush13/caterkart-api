import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { Public, Staff } from '../auth/decorators';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  // Full list exposes vendor PII (phone/email/notes) — staff only.
  @Staff()
  @Get()
  list() {
    return this.vendors.list();
  }

  // public, customer-safe vendor profile (no phone/email/notes)
  @Public()
  @Get('public/:name')
  publicByName(@Param('name') name: string) {
    return this.vendors.publicByName(name);
  }

  // Bodies are flexible blobs; the service normalises/sanitises them.
  @Staff()
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.vendors.create(body);
  }

  @Staff()
  @Put(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.vendors.update(id, body);
  }

  @Staff()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vendors.remove(id);
  }
}
