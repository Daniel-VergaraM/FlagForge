FROM golang:1.27-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o evaluator ./main.go

FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates wget
COPY --from=builder /build/evaluator .
EXPOSE 3002
CMD ["./evaluator"]
