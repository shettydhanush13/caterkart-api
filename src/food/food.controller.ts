import { Controller, Get, Param, Query } from '@nestjs/common';
import { FoodService } from './food.service';

@Controller('food')
export class FoodController {
  constructor(private readonly foodService: FoodService) {}

  @Get(':area')
  async getFoodByArea(
    @Param('area') area: string,
    @Query('vegOnly') vegOnly?: string,
  ) {
    const vegOnlyBool = vegOnly === 'true' ? true : undefined;
    return this.foodService.getAllFormatted(area, vegOnlyBool);
  }

  @Get()
  async getAll(@Query('vegOnly') vegOnly?: string) {
    const vegOnlyBool = vegOnly === 'true' ? true : undefined;
    return this.foodService.getAllFormatted(undefined, vegOnlyBool);
  }
}
