import { Controller, Get, Param, Query, Put, Body, BadRequestException } from '@nestjs/common';
import { FoodService } from './food.service';
import { UpdateFoodItemDto } from './food.dto';

@Controller('food')
export class FoodController {
  constructor(private readonly foodService: FoodService) {}

  @Get('inventory')
  async getFoodInventory() {
    return this.foodService.getFoodInventory();
  }

  @Get('inventory/list/:area')
  async getFoodList(@Param('area') area: string) {
    return this.foodService.getFoodInventoryList(area);
  }
  
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

  /**
   * Bulk update inventory items
   * Body: array of UpdateFoodItemDto
   */
    @Put('inventory/:id')
    async updateInventory(@Param('id') id: string, @Body() item: UpdateFoodItemDto) {
      return this.foodService.updateOneById(id, item);
    }
}
