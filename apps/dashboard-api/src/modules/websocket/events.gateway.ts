import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  path: '/socket.io',
})
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  // Frontend ulanishi uchun
  handleConnection(client: any) {
    console.log('Client ulandi:', client.id);
  }
}