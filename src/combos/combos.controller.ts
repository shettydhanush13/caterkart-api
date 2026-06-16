import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CombosService } from './combos.service';
import { Public, Staff } from '../auth/decorators';

@Controller('combos')
export class CombosController {
  constructor(private readonly combos: CombosService) {}

  @Public()
  @Get()
  list(@Query('mealSlot') mealSlot?: string, @Query('boxType') boxType?: string) {
    return this.combos.list({
      mealSlot: mealSlot || undefined,
      boxType: boxType ? Number(boxType) : undefined,
    });
  }

  // Bodies are flexible blobs (combo content) — the global ValidationPipe skips
  // plain Record<string, any> params; the service normalises/sanitises them.
  @Staff()
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.combos.create(body);
  }

  @Staff()
  @Put(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.combos.update(id, body);
  }

  @Staff()
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.combos.remove(id);
  }
}
