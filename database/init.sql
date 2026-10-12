CREATE DATABASE IF NOT EXISTS team3_inventory;
USE team3_inventory;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
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

INSERT INTO products (name, description, quantity, price)
SELECT 'Teclado USB', 'Teclado de oficina', 25, 249.99
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Teclado USB');
INSERT INTO products (name, description, quantity, price)
SELECT 'Mouse inalámbrico', 'Mouse óptico inalámbrico', 40, 179.50
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Mouse inalámbrico');
INSERT INTO products (name, description, quantity, price)
SELECT 'Monitor 24 pulgadas', 'Monitor para estación de trabajo', 8, 2199.00
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Monitor 24 pulgadas');
