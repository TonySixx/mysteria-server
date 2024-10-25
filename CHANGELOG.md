# Changelog

## [Unreleased]
### Added
- Přidána vizuální zpětná vazba pro poškození a léčení pomocí animovaných textů.
- Implementována vizuální zpětná vazba pro tahy AI.
- Přidána vizuální zpětná vazba pro efekty kouzel a tažení karet.
- Přidány notifikace pro informování hráče o herních událostech.
- Přidána notifikace při pokusu o útok kartou, která není vyložena na herním poli.
- Zobrazení karet protivníka jako rubové strany
- Nová oblast pro zobrazení karet protivníka nad herní plochou
- Přidána podpora pro online multiplayer
- Implementován systém matchmakingu pro hledání protihráčů
- Přidána synchronizace herního stavu mezi hráči
- Implementována správa připojení a odpojení hráčů
- Přidáno čekání na protihráče
- Implementováno herní lobby pro matchmaking
- Přidána vizuální indikace při hledání protihráče
- Implementována synchronizace herního stavu mezi hráči
- Přidáno skrývání karet protihráče
- Přidána podpora pro více současně běžících her
- Implementována základní ochrana proti podvádění

### Changed
- Vylepšena vizuální stránka hry přidáním dynamických efektů pro lepší uživatelský zážitek.
- Upraveno zobrazování poškození, nyní se zobrazuje přesněji u místa útoku pro obě jednotky.
- Prodloužena doba zobrazení vizuální zpětné vazby z 1,5 na 2,5 sekundy.
- Zvýšena výraznost vizuální zpětné vazby zvětšením písma a zesílením stínu.
- Přidáno zpoždění pro zobrazení poškození u útočící jednotky pro správné umístění textu.
- Vylepšena zpětná vazba pro hráče při nelegálních tazích.
- Vylešen design notifikací - nyní se zobrazují uprostřed obrazovky s černým poloprůhledným pozadím.
- Změněno písmo notifikací na Arial.
- Přidána plynulá animace pro objevení a zmizení notifikací.
- Prodloužena doba zobrazení notifikací pro lepší čitelnost.
- Vylepšena logika drag and drop pro prevenci nelegálních tahů.
- Vylepšena umělá inteligence nepřítele pro náročnější a zajímavější hru
  - AI nyní lépe prioritizuje cíle při útoku
  - Implementována lepší strategie pro hraní karet
  - AI nyní efektivněji využívá manu a The Coin
- Upravena komponenta CardDisplay pro zobrazení rubové strany karet protivníka
- Upraveno zobrazení karet protivníka - nyní se zobrazuje pouze rubová strana karty bez dalších informací
- Upravena herní logika pro podporu více hráčů
- Vylepšena stabilita síťové komunikace
- Optimalizována synchronizace herního stavu
- Upravena struktura aplikace pro podporu online hraní
- Vylepšeno UI pro lepší uživatelský zážitek při čekání na protihráče
- Optimalizována síťová komunikace mezi klientem a serverem

### Removed
- Odstraněno tlačítko "útok" z karet jednotek.
- Odstraněno tlačítko "Seslat" z karet kouzel, protože nyní lze kouzla sesílat pomocí drag&drop.

### Fixed
- Opraveno vkládání karet mezi existující karty na herním poli.
- Odstraněno varování o nekonsekutivních indexech Draggable komponent.
- Opravena chyba, která bránila vyložení karty na stůl pomocí přetažení.
- Opravena chyba, která neumožňovala vybrat konkrétní cíl útoku mezi nepřátelskými jednotkami.
- Opravena chyba, která bránila provedení útoku při přetažení karty na cíl.
- Odstraněna nadbytečná Droppable oblast pro celé nepřítelovo pole.
- Opravena chyba, která umožňovala ignorovat efekt Taunt při útoku pomocí drag&drop.
- Opravena chyba s nekonzistentními indexy Draggable komponent v ruce hráče.
- Vylepšena logika pro hraní karet pomocí drag and drop, nyní zahrnuje i kouzla.
- Opravena chyba "Cannot read properties of undefined (reading 'health')" při útoku AI
- Přidána dodatečná kontrola existence útočníka a obránce před provedením útoku
- Vylepšena funkce pro výběr cíle útoku AI, aby vždy vracela platný cíl
- Opraveno volání funkce addCombatLogEntry - doplněny chybějící parametry
- Vylepšeno logování bojových akcí s přesnějšími informacemi o útočníkovi a cíli
- Opraveny problémy s připojením při výpadku sítě
- Vyřešeny problémy s desynchronizací herního stavu

### Changed
- Upraveno chování karet v ruce hráče - všechny karty jsou nyní přetahovatelné, kouzla lze stále zahrát kliknutím.
- Sjednoceno chování pro hraní všech typů karet - nyní se všechny karty hrají pomocí drag&drop.

### Změněno
- Upravena funkce `playCardCommon` pro správné zpracování karty "The Coin"
- Implementována funkce `playCoin` pro správné zpracování karty "The Coin"

### Přidáno
- Podrobné výpisy do konzole pro akce AI hráče
- Sledování stavu many AI hráče během jeho tahu

### Změněno
- Vylepšena čitelnost a srozumitelnost kódu AI hráče

### Změněno
- Vylepšena strategie AI pro hraní karet:
  - AI nyní preferuje vyložení jednotek před použitím kouzel
  - AI se snaží udržet alespoň 3 jednotky na poli, pokud má dostatek many
  - Kouzla jsou používána strategičtěji, většinou až po vyložení jednotek
  - Léčivá kouzla jsou používána, když má AI méně než 15 zdraví

