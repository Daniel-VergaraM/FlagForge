import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberRole } from '@prisma/client';

@ApiTags('API Keys')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @Roles(MemberRole.ADMIN, MemberRole.OWNER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create a new API key' })
  create(@Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List API keys' })
  findAll(@Query('environmentId') environmentId?: string) {
    return this.apiKeysService.findAll(environmentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an API key by ID' })
  findOne(@Param('id') id: string) {
    return this.apiKeysService.findOne(id);
  }

  @Delete(':id')
  @Roles(MemberRole.ADMIN, MemberRole.OWNER)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key' })
  async revoke(@Param('id') id: string) {
    await this.apiKeysService.revoke(id);
  }
}
