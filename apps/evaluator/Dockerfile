FROM golang:1.27-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o evaluator ./main.go

FROM alpine:latest
WORKDIR /app
RUN apk --no-cache upgrade \
  && apk --no-cache add ca-certificates wget \
  && addgroup -S evaluator && adduser -S evaluator -G evaluator
COPY --from=builder /build/evaluator .
RUN chown evaluator:evaluator /app/evaluator
USER evaluator
EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1
CMD ["./evaluator"]
