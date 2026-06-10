import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Audit } from '../auth/decorators/audit.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberRole } from '@prisma/client';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @Roles(MemberRole.ADMIN, MemberRole.OWNER)
  @UseGuards(RolesGuard)
  @Audit('CREATE', 'Webhook')
  @ApiOperation({ summary: 'Create a webhook' })
  create(@Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(dto);
  }

  @Get()
  @Roles(MemberRole.ADMIN, MemberRole.OWNER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List webhooks for a project' })
  findAll(@Query('projectId') projectId: string) {
    return this.webhooksService.findAll(projectId);
  }

  @Get(':id')
  @Roles(MemberRole.ADMIN, MemberRole.OWNER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get a webhook by ID' })
  findOne(@Param('id') id: string) {
    return this.webhooksService.findOne(id);
  }

  @Patch(':id')
  @Roles(MemberRole.ADMIN, MemberRole.OWNER)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'Webhook', 'id')
  @ApiOperation({ summary: 'Update a webhook' })
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooksService.update(id, dto);
  }

  @Delete(':id')
  @Roles(MemberRole.ADMIN, MemberRole.OWNER)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('DELETE', 'Webhook', 'id')
  @ApiOperation({ summary: 'Delete a webhook' })
  async remove(@Param('id') id: string) {
    await this.webhooksService.remove(id);
  }
}
