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
import { CreatePincodeDto, UpdatePincodeDto } from './pincodes.dto';
import { Public, Staff } from '../auth/decorators';

@Controller('pincodes')
export class PincodesController {
  constructor(private readonly pincodes: PincodesService) {}

  @Staff()
  @Get()
  list() {
    return this.pincodes.list();
  }

  // public serviceability check: GET /pincodes/check/560001
  @Public()
  @Get('check/:pincode')
  check(@Param('pincode') pincode: string) {
    return this.pincodes.serviceability(pincode);
  }

  @Staff()
  @Post()
  create(@Body() body: CreatePincodeDto) {
    return this.pincodes.create(body);
  }

  @Staff()
  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdatePincodeDto) {
    return this.pincodes.update(id, body);
  }

  @Staff()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pincodes.remove(id);
  }
}
