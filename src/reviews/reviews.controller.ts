import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './reviews.dto';
import { Public } from '../auth/decorators';

@Public()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // GET /reviews/:vendorName  → { summary, reviews }
  @Get(':vendorName')
  async byVendor(@Param('vendorName') vendorName: string, @Query('limit') limit?: string) {
    const [summary, reviews] = await Promise.all([
      this.reviews.summary(vendorName),
      this.reviews.list(vendorName, limit ? Number(limit) : 30),
    ]);
    return { summary, reviews };
  }

  @Post()
  create(@Body() body: CreateReviewDto) {
    return this.reviews.create(body);
  }
}
