-- Add "Contactado" stage between Lead (0) and Potencial Cliente (1)
-- Shift existing stages up by 1 to make room
UPDATE leads_contact_stages SET order_index = order_index + 1 WHERE order_index >= 1;

INSERT INTO leads_contact_stages (name, description, color, order_index, is_default)
VALUES ('Contactado', 'Primeiro contacto realizado com sucesso', '#06b6d4', 1, false)
ON CONFLICT DO NOTHING;
