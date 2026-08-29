-- ============================================================================
--  Sarah & Tin — Carga de ingredientes de repostería (sin precio)
--
--  Cómo usar:
--  1. Supabase -> SQL Editor -> New query.
--  2. Pega TODO este archivo y ejecútalo (Run).
--  3. Los ingredientes quedan con precio y stock en 0. Luego les pones el
--     costo y el stock desde la app (Ingredientes -> editar) o desde la tabla.
--
--  Nota: asigna los ingredientes al PRIMER usuario de tu proyecto. Si tienes
--  más de un usuario y quieres otro, cambia el subselect de owner_id por:
--     (select id from auth.users where email = 'tu-correo@ejemplo.com')
--
--  Es seguro re-ejecutarlo: no duplica ingredientes que ya existan (por nombre).
-- ============================================================================

insert into public.ingredients (owner_id, name, category, unit)
select src.owner_id, src.name, src.category, src.unit
from (
  select
    (select id from auth.users order by created_at asc limit 1) as owner_id,
    v.name, v.category, v.unit
  from (values
    -- Harinas y secos (peso, g)
    ('Harina sin polvos',        'Harinas y secos', 'g'),
    ('Harina con polvos de hornear', 'Harinas y secos', 'g'),
    ('Harina integral',          'Harinas y secos', 'g'),
    ('Maicena (almidón de maíz)','Harinas y secos', 'g'),
    ('Sémola',                   'Harinas y secos', 'g'),
    ('Avena',                    'Harinas y secos', 'g'),
    ('Harina de almendras',      'Harinas y secos', 'g'),
    ('Coco rallado',             'Harinas y secos', 'g'),
    ('Cacao en polvo amargo',    'Harinas y secos', 'g'),

    -- Azúcares y endulzantes (peso, g)
    ('Azúcar granulada',         'Azúcares', 'g'),
    ('Azúcar flor',              'Azúcares', 'g'),
    ('Azúcar rubia',             'Azúcares', 'g'),
    ('Azúcar morena',            'Azúcares', 'g'),
    ('Miel',                     'Azúcares', 'g'),
    ('Glucosa',                  'Azúcares', 'g'),
    ('Manjar (dulce de leche)',  'Azúcares', 'g'),
    ('Leche condensada',         'Azúcares', 'g'),

    -- Leudantes y gelificantes (peso, g)
    ('Polvos de hornear',        'Leudantes', 'g'),
    ('Bicarbonato de sodio',     'Leudantes', 'g'),
    ('Levadura seca',            'Leudantes', 'g'),
    ('Levadura fresca',          'Leudantes', 'g'),
    ('Crémor tártaro',           'Leudantes', 'g'),
    ('Gelatina sin sabor',       'Leudantes', 'g'),

    -- Lácteos
    ('Leche',                    'Lácteos', 'ml'),
    ('Leche evaporada',          'Lácteos', 'ml'),
    ('Crema para batir (nata)',  'Lácteos', 'ml'),
    ('Mantequilla',              'Lácteos', 'g'),
    ('Margarina',                'Lácteos', 'g'),
    ('Queso crema',              'Lácteos', 'g'),
    ('Yogurt natural',           'Lácteos', 'g'),

    -- Huevos (unidad)
    ('Huevos',                   'Huevos', 'unidad'),

    -- Grasas y aceites (volumen, ml)
    ('Aceite vegetal',           'Grasas y aceites', 'ml'),
    ('Aceite de coco',           'Grasas y aceites', 'ml'),

    -- Chocolate (peso, g)
    ('Cobertura de chocolate semiamargo', 'Chocolate', 'g'),
    ('Chocolate blanco',         'Chocolate', 'g'),
    ('Chocolate de leche',       'Chocolate', 'g'),
    ('Chips de chocolate',       'Chocolate', 'g'),
    ('Crema de avellanas',       'Chocolate', 'g'),

    -- Frutos secos (peso, g)
    ('Almendras',                'Frutos secos', 'g'),
    ('Nueces',                   'Frutos secos', 'g'),
    ('Maní',                     'Frutos secos', 'g'),
    ('Avellanas',                'Frutos secos', 'g'),
    ('Pasas',                    'Frutos secos', 'g'),

    -- Frutas
    ('Frutillas',                'Frutas', 'g'),
    ('Plátano',                  'Frutas', 'unidad'),
    ('Manzana',                  'Frutas', 'unidad'),
    ('Limón',                    'Frutas', 'unidad'),
    ('Naranja',                  'Frutas', 'unidad'),
    ('Mermelada',                'Frutas', 'g'),

    -- Saborizantes y especias
    ('Esencia de vainilla',      'Saborizantes', 'ml'),
    ('Ralladura de limón',       'Saborizantes', 'g'),
    ('Canela en polvo',          'Saborizantes', 'g'),
    ('Nuez moscada',             'Saborizantes', 'g'),
    ('Jengibre en polvo',        'Saborizantes', 'g'),
    ('Café instantáneo',         'Saborizantes', 'g'),
    ('Sal',                      'Saborizantes', 'g'),
    ('Colorante alimentario',    'Saborizantes', 'ml'),

    -- Decoración (peso, g)
    ('Fondant',                  'Decoración', 'g'),
    ('Grageas / sprinkles',      'Decoración', 'g'),
    ('Perlas de azúcar',         'Decoración', 'g'),
    ('Merengue en polvo',        'Decoración', 'g'),
    ('Frutas confitadas',        'Decoración', 'g')
  ) as v(name, category, unit)
) as src
where not exists (
  select 1 from public.ingredients i
  where i.owner_id = src.owner_id
    and lower(i.name) = lower(src.name)
);
