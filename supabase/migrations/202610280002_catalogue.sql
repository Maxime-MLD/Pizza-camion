-- Generated from src/data/pizzas.ts. Unconfirmed prices are unavailable until verified.
insert into public.pizzas(id,name,description,price_cents,available) values
('capri','Capri','Tomate, épaule, mozzarella',1000,true),
('maestro','Maestro','Tomate, épaule, champignons, mozzarella',1100,true),
('biquette','Biquette','Crème, chèvre, mozzarella, miel',1100,true),
('pecheur','Pêcheur','Tomate, thon, crème, mozzarella',1100,true),
('fromagio','Fromagio','Tomate, chèvre, bleu, mozzarella',1200,true),
('mexico','Mexico','Tomate, bœuf haché, poivrons, mozzarella',1200,true),
('bolognaise','Bolognaise','Tomate, bœuf haché, chorizo, merguez, oignons, mozzarella',1200,true),
('savoyarde','Savoyarde','Crème, pommes de terre, lardons, reblochon, mozzarella',1200,true),
('campagnarde','Campagnarde','Crème, andouillette, oignons, lardons, mozzarella',1200,true),
('montagnarde','Montagnarde','Crème, pommes de terre, lardons, raclette, mozzarella',1200,false),
('norvegienne','Norvégienne','Crème, saumon, aneth, mozzarella',1300,false),
('vegetarienne','Végétarienne','Tomate, poivrons, oignons, champignons, mozzarella',1200,true),
('royale','Royale','Tomate, chèvre, jambon cru, mozzarella',1200,true)
on conflict(id) do nothing;
