# Casa Luna Backoffice - Vistas completas para consumo de backend

Esta versión reemplaza las pantallas placeholder por vistas funcionales de frontend con datos mock y estructura preparada para conectar endpoints ASP.NET Core.

## Módulos implementados

- Reservaciones
- Check-in / Check-out
- Estado de habitaciones
- Anticipos
- Clientes al crédito
- Cierres por turno
- Desayunos de cortesía / QR
- Eventos y salones / coworking
- Habitaciones y tarifas
- Mantenimiento
- Inventario de snacks/minibar
- Inventario de blancos y mobiliario
- Inventario de suministros
- Facturación
- Reportes gerenciales
- Usuarios, roles, permisos y auditoría

## Convención para Alejandro

Cada vista incluye una pestaña llamada `Contrato backend` con endpoints sugeridos. Esa pestaña no es para usuario final, es para alinear frontend/backend antes de conectar la API.

## Próximo paso backend

Crear backend ASP.NET Core Web API con Clean Architecture:

- Api
- Application
- Domain
- Infrastructure

Primero modelar entidades base:

- Reservation
- Guest
- Room
- RoomType
- Payment / Advance
- CheckIn
- CheckOut
- Invoice
- CashClose
- CreditAccount
- BreakfastVoucher
- Event
- InventoryItem
- InventoryMovement
- MaintenanceOrder
- User
- Role
- AuditLog

Después exponer endpoints por módulo según las pestañas `Contrato backend`.
