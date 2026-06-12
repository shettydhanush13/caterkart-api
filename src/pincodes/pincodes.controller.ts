import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PincodesService } from './pincodes.service';

@Controller('pincodes')
export class PincodesController {
  constructor(private readonly pincodes: PincodesService) {}

  @Get()
  list() {
    return this.pincodes.list();
  }

  // public serviceability check: GET /pincodes/check/560001
  @Get('check/:pincode')
  check(@Param('pincode') pincode: string) {
    return this.pincodes.serviceability(pincode);
  }

  @Post()
  create(@Body() body: Record<string, any>) {
    return this.pincodes.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.pincodes.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pincodes.remove(id);
  }
}
