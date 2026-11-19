-- Wines & Drinks retail category (sort_order 26).
insert into store_categories(name,slug,description,icon,sort_order,features,attributes,workflow,is_active) values
('Wines & Drinks','wines-drinks','Wine shops, liquor stores and drinks vendors: wines, whisky, spirits, beer, champagne, soft drinks, juices and bottled water. Alcoholic drinks are for adults 18+ only.','wine',26,'{"catalogue":true,"cart":true,"stock":true,"variants":true,"delivery":true,"pickup":true,"reviews":true,"quotations":true}'::jsonb,'[]'::jsonb,'[]'::jsonb,true)
on conflict(slug) do update set name=excluded.name,description=excluded.description,icon=excluded.icon,features=excluded.features,is_active=true;
