import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @IsString()
  @IsOptional()
  secret?: string;

  @IsString({ each: true })
  @IsArray()
  @IsNotEmpty()
  events: string[];

  @IsBoolean()
  @IsOptional()
  active?: boolean = true;
}
