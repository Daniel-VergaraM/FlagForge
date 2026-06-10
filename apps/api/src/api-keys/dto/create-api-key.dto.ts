import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  environmentId: string;

  @IsString()
  @IsOptional()
  name?: string;
}
