import { useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@/services/api/client';

export const useAppointmentsSocket = (onAppointmentUpdate) => {
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(API_BASE_URL.replace('/api/v1', ''), {
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
    });

    socketRef.current.on('appointmentChanged', (data) => {
      // data = { type: 'created' | 'updated' | 'statusChanged' | 'cancelled', appointment }
      onAppointmentUpdate?.(data);
    });

    socketRef.current.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [onAppointmentUpdate]);

  return socketRef.current;
};