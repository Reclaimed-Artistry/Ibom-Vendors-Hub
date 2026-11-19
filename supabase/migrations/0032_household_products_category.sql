-- Household Products is a physical-goods category, not a domestic service or property category.
-- Add reference data only: never create inventory or recategorise existing listings.
insert into store_categories(name,slug,description,icon,sort_order,features,attributes,workflow,is_active) values
('Household Products','household-products','Everyday home essentials: kitchenware, cookware, cleaning and laundry supplies, bathroom accessories, bedding, furniture, storage, decor, lighting, home appliances, tools and garden items.','house',28,'{"catalogue":true,"cart":true,"stock":true,"variants":true,"delivery":true,"pickup":true,"reviews":true,"quotations":true}'::jsonb,'[]'::jsonb,'[]'::jsonb,true)
on conflict(slug) do update set name=excluded.name,description=excluded.description,icon=excluded.icon,features=excluded.features,is_active=true;
