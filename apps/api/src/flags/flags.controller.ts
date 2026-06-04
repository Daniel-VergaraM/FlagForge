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
import { FlagsService } from './flags.service';
import { AuditService } from '../audit/audit.service';
import { CreateFlagDto } from './dto/create-flag.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Audit } from '../auth/decorators/audit.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberRole } from '@prisma/client';

@ApiTags('Flags')
@Controller('flags')
export class FlagsController {
  constructor(
    private readonly flagsService: FlagsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Roles(MemberRole.EDITOR, MemberRole.ADMIN, MemberRole.OWNER)
  @UseGuards(RolesGuard)
  @Audit('CREATE', 'Flag')
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
  @Roles(MemberRole.EDITOR, MemberRole.ADMIN, MemberRole.OWNER)
  @UseGuards(RolesGuard)
  @Audit('UPDATE', 'Flag', 'id')
  @ApiOperation({ summary: 'Update a feature flag' })
  update(@Param('id') id: string, @Body() dto: UpdateFlagDto) {
    return this.flagsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(MemberRole.ADMIN, MemberRole.OWNER)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('DELETE', 'Flag', 'id')
  @ApiOperation({ summary: 'Delete a feature flag' })
  async remove(@Param('id') id: string) {
    await this.flagsService.remove(id);
  }

  @Get(':id/audit')
  @ApiOperation({ summary: 'Get audit history for a flag' })
  async getAuditHistory(@Param('id') id: string) {
    return this.auditService.findByEntity('Flag', id);
  }
}
