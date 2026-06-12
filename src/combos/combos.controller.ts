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

@Controller('combos')
export class CombosController {
  constructor(private readonly combos: CombosService) {}

  @Get()
  list(@Query('mealSlot') mealSlot?: string, @Query('boxType') boxType?: string) {
    return this.combos.list({
      mealSlot: mealSlot || undefined,
      boxType: boxType ? Number(boxType) : undefined,
    });
  }

  // Bodies are flexible blobs (combo content) — the global ValidationPipe skips
  // plain Record<string, any> params; the service normalises/sanitises them.
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.combos.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.combos.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.combos.remove(id);
  }
}
