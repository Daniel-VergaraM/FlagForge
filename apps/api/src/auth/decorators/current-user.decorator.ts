import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { MemberRole } from '@prisma/client';

export interface CurrentUserPayload {
  id: string;
  email: string;
  name?: string;
  role: string;
  projectRole?: MemberRole;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserPayload;
    return data ? user?.[data] : user;
  },
);
