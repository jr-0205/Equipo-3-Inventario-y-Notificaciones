-- Equipo 3 - Inventario (MySQL 8)
--
-- Inventario guarda UNICAMENTE las existencias. El nombre, la descripcion y el precio
-- se leen del catalogo del Equipo 1; la columna `id` es el ID de ese catalogo, para que
-- Pedidos use el mismo ID al consultar el precio y descontar existencias.
--
-- Este script solo se ejecuta la PRIMERA vez que se crea el volumen de MySQL. Si el
-- volumen ya existia, los cambios de esquema no se vuelven a aplicar.

CREATE DATABASE IF NOT EXISTS team3_inventory;
USE team3_inventory;

CREATE TABLE IF NOT EXISTS products (
  -- ID del producto en el catalogo del Equipo 1 (no es un ID propio de Inventario).
  id INT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  quantity INT NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service VARCHAR(80) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Datos de ejemplo alineados con el catalogo del Equipo 1
-- (Productos: 1 = Laptop Dell 12999.00, 2 = Mouse Inalámbrico 349.00).
INSERT INTO products (id, name, description, quantity, price)
SELECT 1, 'Laptop Dell', 'Laptop de 15 pulgadas', 8, 12999.00
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 1);

INSERT INTO products (id, name, description, quantity, price)
SELECT 2, 'Mouse Inalámbrico', 'Mouse óptico inalámbrico', 25, 349.00
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 2);
