import { Controller, Get, Param, Query, Put, Body } from '@nestjs/common';
import { FoodService } from './food.service';
import { UpdateFoodItemDto } from './food.dto';
import { Public, Staff } from '../auth/decorators';

@Controller('food')
export class FoodController {
  constructor(private readonly foodService: FoodService) {}

  @Staff()
  @Get('inventory')
  async getFoodInventory() {
    return this.foodService.getFoodInventory();
  }

  @Staff()
  @Get('inventory/list/:area')
  async getFoodList(@Param('area') area: string) {
    return this.foodService.getFoodInventoryList(area);
  }

  @Public()
  @Get(':area')
  async getFoodByArea(
    @Param('area') area: string,
    @Query('vegOnly') vegOnly?: string,
  ) {
    const vegOnlyBool = vegOnly === 'true' ? true : undefined;
    return this.foodService.getAllFormatted(area, vegOnlyBool);
  }

  @Public()
  @Get()
  async getAll(@Query('vegOnly') vegOnly?: string) {
    const vegOnlyBool = vegOnly === 'true' ? true : undefined;
    return this.foodService.getAllFormatted(undefined, vegOnlyBool);
  }

  /**
   * Bulk update inventory items
   * Body: array of UpdateFoodItemDto
   */
    @Staff()
    @Put('inventory/:id')
    async updateInventory(@Param('id') id: string, @Body() item: UpdateFoodItemDto) {
      return this.foodService.updateOneById(id, item);
    }
}
