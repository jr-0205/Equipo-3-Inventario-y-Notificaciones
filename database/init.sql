CREATE DATABASE IF NOT EXISTS team3_inventory;
USE team3_inventory;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT,
  stock INT NOT NULL DEFAULT 0,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  servicio VARCHAR(80) NOT NULL,
  mensaje TEXT NOT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'info',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (nombre, descripcion, stock, precio)
SELECT 'Teclado USB', 'Teclado de oficina', 25, 249.99
WHERE NOT EXISTS (SELECT 1 FROM products WHERE nombre = 'Teclado USB');
INSERT INTO products (nombre, descripcion, stock, precio)
SELECT 'Mouse inalámbrico', 'Mouse óptico inalámbrico', 40, 179.50
WHERE NOT EXISTS (SELECT 1 FROM products WHERE nombre = 'Mouse inalámbrico');
INSERT INTO products (nombre, descripcion, stock, precio)
SELECT 'Monitor 24 pulgadas', 'Monitor para estación de trabajo', 8, 2199.00
WHERE NOT EXISTS (SELECT 1 FROM products WHERE nombre = 'Monitor 24 pulgadas');
