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

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Get()
  list() {
    return this.vendors.list();
  }

  // Bodies are flexible blobs; the service normalises/sanitises them.
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.vendors.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.vendors.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vendors.remove(id);
  }
}
