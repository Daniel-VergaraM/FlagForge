FROM golang:1.22-alpine AS builder
WORKDIR /build
COPY . .
RUN go mod download && go build -o evaluator ./main.go

FROM alpine:latest
WORKDIR /app
COPY --from=builder /build/evaluator .
EXPOSE 3002
CMD ["./evaluator"]
