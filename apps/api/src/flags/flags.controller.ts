import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { FlagsService } from './flags.service';
import { CreateFlagDto } from './dto/create-flag.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Flags')
@Controller('flags')
export class FlagsController {
  constructor(private readonly flagsService: FlagsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a feature flag' })
  create(@Body() dto: CreateFlagDto) {
    return this.flagsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List feature flags' })
  findAll(
    @Query('environmentId') envId?: string,
    @Query('q') query?: string,
  ) {
    return this.flagsService.findAll(envId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a feature flag by ID' })
  findOne(@Param('id') id: string) {
    return this.flagsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a feature flag' })
  update(@Param('id') id: string, @Body() dto: UpdateFlagDto) {
    return this.flagsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a feature flag' })
  async remove(@Param('id') id: string) {
    await this.flagsService.remove(id);
  }
}
