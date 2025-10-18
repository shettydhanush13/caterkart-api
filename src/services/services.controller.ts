import { Controller, Get, Param, Put, Body, NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('inventory/:category')
  async getInventory(@Param('category') category: string) {
    return this.servicesService.getInventory(category);
  }

  @Put('inventory/:category/:id')
  async updateInventoryItem(
    @Param('category') category: string,
    @Param('id') id: string,
    @Body() item: any,
  ) {
    const updated = await this.servicesService.updateInventory(category, id, item);
    if (!updated) throw new NotFoundException('Item not found or update failed');
    return updated;
  }

  @Get(':eventName')
  async getServicesByEvent(@Param('eventName') eventName: string) {
    return this.servicesService.getServicesByEvent(eventName);
  }
}
