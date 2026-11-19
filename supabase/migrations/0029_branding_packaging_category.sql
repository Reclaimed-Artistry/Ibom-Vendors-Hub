-- Branding & Packaging category (sort_order 27).
insert into store_categories(name,slug,description,icon,sort_order,features,attributes,workflow,is_active) values
('Branding & Packaging','branding-packaging','Brand identity designers and packaging suppliers: logos, brand guidelines, signage, custom boxes, labels, bags, bottles and product packaging.','package',27,'{"catalogue":true,"cart":true,"stock":true,"variants":true,"delivery":true,"pickup":true,"reviews":true,"quotations":true,"madeToOrder":true,"productionTracking":true}'::jsonb,'[]'::jsonb,'[]'::jsonb,true)
on conflict(slug) do update set name=excluded.name,description=excluded.description,icon=excluded.icon,features=excluded.features,is_active=true;
