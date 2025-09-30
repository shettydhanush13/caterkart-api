import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
export default function setupSwagger(nestApp: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Order Management')
    .setDescription('The Order and Inventory Management Service enables the management of available items by allowing updates to their price and quantity. When a customer places an order, the service checks whether the requested items can be fulfilled based on the current stock. Additionally, it calculates the total cost for the items that can be fulfilled, ensuring efficient inventory control and smooth order processing.')
    .setVersion('1.0')
    .addTag('Health')
    .addTag('Order')
    .addTag('OTP')
    .build();
  const document = SwaggerModule.createDocument(nestApp, config);
  SwaggerModule.setup('/doc', nestApp, document, {
    swaggerOptions: { defaultModelsExpandDepth: -1 },
  });
}
