import { Controller, Get, Param } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get(':eventName')
  async getServicesByEvent(@Param('eventName') eventName: string) {
    return this.servicesService.getServicesByEvent(eventName);
  }
}
