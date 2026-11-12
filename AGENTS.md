# Architecture
- Keep the Pedido workflow client-only and read-only against AppContext; planning purchases must never create stock movements or modify existing inventory workflows.
- Keep Pedido calculations and export generation in dedicated modules so existing forecast and report calculations remain untouched.