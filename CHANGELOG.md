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
- Přidána vizuální indikace při hledán protihráče
- Implementována synchronizace herního stavu mezi hráči
- Přidáno skrývání karet protihráče
- Přidána podpora pro více současně běžících her
- Implementována základní ochrana proti podvádění
- Implementována podpora pro online multiplayer
- Přidána socketov komunikace mezi klientem a serverem
- Přidána synchronizace herního stavu mezi hráči
- Přidány kontroly pro validní tahy v online hře
- Přidány konstanty pro herní události a stavy
- Implementován SocketProvider pro správu socketové komunikace
- Přidána podpora pro reconnect při výpadku spojení
- Vylepšena struktura aplikace pro lepší správu socketové komunikace
- Přidána podpora pro socket.io-style event handling v SocketService
- Implementována správa event listenerů pro lepší cleanup
- Přidána nová oblast pro zobrazení karet v ruce protivníka nad jeho hrdinou
- Implementováno správné zobrazení rubových stran karet protivníka
- Implementována funkce checkGameOver pro detekci konce hry
  - Kontrola životů hrdinů
  - Určení vítěze nebo remízy
  - Deaktivace všech karet při konci hry
- Přidán modal pro zobrazení konce hry
- Implementováno zobrazení výsledku hry (výhra/prohra/remíza)
- Přidány notifikace pro Taunt efekt
  - Upozornění při pokusu o útok na jednotku bez Taunt
  - Upozornění při pokusu o útok na hrdinu přes Taunt
- Přidána konfigurace pro deployment na Render.com
- Přidána podpora pro CORS v produkčním prostředí
- Implementováno prostředí pro produkční nasazení
- Přidáno podrobné logování pro debugování notifikací
  - Logování příchozích notifikací ze serveru
  - Sledování zpracování notifikací v komponentě
  - Logování drag & drop operací a útoků
  - Přidáno logování kontroly cílového hráče pro notifikace
- Přidány tooltips v angličtině pro balíček karet a mana krystaly
  - Tooltip pro balíček: "Remaining cards in deck"
  - Tooltip pro manu: "Current/Maximum mana crystals - Used to play cards"
- Implementován Combat Log systém
  - Přidáno logování všech herních akcí
  - Formátované zprávy s barevným rozlišením
  - Logování útoků, kouzel a efektů jednotek
  - Časové značky pro všechny akce
  - Přenos combat log zpráv ze serveru na klienta
- Rozšířen Combat Log systém
  - Přidány detailní zprávy pro všechna kouzla a jejich efekty
  - Přidány zprávy pro efekty jednotek při vyložení
  - Vylepšeno formátování zpráv s barevným rozlišením různých typů efektů
  - Změněno označení "AI" na "Enemy" pro multiplayer režim
- Přidáno logování vyložení jednotek na stůl
  - Zobrazení jména jednotky
  - Zobrazení útoku a zdraví jednotky
  - Zachování konzistentního formátování s ostatními logy
- Implementován systém uživatelských účtů
  - Přihlašování a registrace uživatelů
  - Profily hráčů s historií her
  - Žebříček nejlepších hráčů
  - Statistiky výher a proher
  - Systém hodnocení (rank)
- Přidáno zobrazení žebříčku do hlavního menu
- Implementována perzistence herních výsledků
- Přidána autentizace pro Socket.IO spojení

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
- Upravena logika tahů pro podporu online hry
- Vylepšena vizuální zpětná vazba pro online interakce
- Upraveno zobrazování UI elementů podle stavu hry
- Upravena architektura aplikace pro lepší oddělení socketové logiky
- Přesunuty hern konstanty do sdíleného modulu
- Upraveno pozicování herních elementů pro lepší přehlednost
- Vylepšeno zobrazení karet v ruce protivníka - nyní jsou viditelné nad jeho hrdinou
- Upravena konfigurace socketů pro produkční prostředí
- Přidány environment variables pro různá prostředí
- Upravena struktura hlavního menu pro podporu uživatelských účtů
- Vylepšeno UI pro lepší uživatelskou přívětivost
- Optimalizováno načítání dat ze Supabase

### Removed
- Odstraněno tlačítko "útok" z karet jednotek.
- Odstraněno tlačítko "Seslat" z karet kouzel, protože nyní lze kouzla sesílat pomocí drag&drop.

### Fixed
- Opraveno vkládání karet mezi existující karty na herním poli.
- Odstraněno varování o nekonsekutivních indexech Draggable komponent.
- Opravena chyba, která bránila vyložení karty na stůl pomocí přetažení.
- Opravena chyba, která neumožňovala vybrat konkrétní cíl útoku mezi nepřátelskými jednotkami.
- Opravena chyba, která bránila provedení útoku při přetažení karty na cíl.
- Odstranna nadbytečná Droppable oblast pro celé nepřítelovo pole.
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
- Vylepšena čitelnost a srozumitelnost kódu AI hráe

### Změněno
- Vylepšena strategie AI pro hraní karet:
  - AI nyní preferuje vyložení jednotek před použitím kouzel
  - AI se snaží udržet alespoň 3 jednotky na poli, pokud má dostatek many
  - Kouzla jsou používána strategičtěji, většinou až po vyložení jednotek
  - Léčivá kouzla jsou používána, když má AI méně než 15 zdraví

### Fixed
- Opraveny styly karet a herní plochy pro lepší vizuální prezentaci
- Upraveno pozicování karet v ruce hráče
- Vylepšena čitelnost karet přidáním tmavého pozadí
- Optimalizovno rozvržení herní plochy
- Opraveno použití styled komponent v GameScene
- Obnovena správná hierarchie komponent pro lepší vizuální prezentaci
- Opraveno zobrazení karet v ruce a na herním poli
- Opravena struktura GameScene komponenty pro lepší state management
- Obnoveno správné použití styled komponent
- Opraveno zobrazení karet v ruce a na herním poli
- Vylepšena stabilita drag & drop funkcionality

### Fixed
- Opravena funkčnost drag & drop operací
- Přidána chybějící implementace onDragEnd funkce
- Vylepšena kontrola legálních tahů při přetahování karet

### Fixed
- Opraveno pozadí karet - přidáno původní texturované pozadí
- Opravena funkčnost vykládání karet na hern pole
- Obnoveny Droppable zóny pro správnou funkčnost drag & drop

### Fixed
- Opraveno překrývání tlačítka "Ukončit tah" kartami v ruce
- Upraveno pozicování herních elementů pro lepší přístupnost ovládacích prvků

### Fixed
- Opraveny problémy s připojením k serveru
  - Přidána podpora pro CORS credentials
  - Přidán polling jako fallback pro websocket
  - Aktualizovány allowed origins pro CORS
  - Opravena URL serveru v konfiguraci
- Sjednoceny porty pro socketovou komunikaci
- Vylepšena inicializace socketového připojení
- Přidána lepší správa životnho cyklu socket instance

### Changed
- Přepracována architektura socketové komunikace pro použití jednotného socketService
- Odstraněn SocketContext ve prospěch přímého použití socketService
- Zjednodušena struktura aplikace odstraněním redundantní socketové vrstvy

### Fixed
- Opravena chyba "socket.on is not a function"
- Vylepšena stabilita socketové komunikace

### Fixed
- Opraveny case-sensitive importy pro SocketService
- Sjednoceno pojmenování souborů a importů

### Fixed
- Opravena chyba "socketService.on is not a function"
- Vylepšena správa socketových event listenerů
- Přidán správný cleanup při odpojení socketu

### Changed
- Odstraněna AI logika z GameScene komponenty
- Přepracována GameScene pro plnou podporu multiplayeru
- Přesunuta veškerá herní logika na server
- Upraveno zobrazení pro multiplayer režim

### Removed
- Odstraněna lokální AI logika
- Odstraněna lokální manipulace s herním stavem

### Fixed
- Opravena chyba při inicializaci herního stavu v GameScene
- Přidány defaultní hodnoty pro případ chybějícího serverového stavu
- Vylepšeno logování pro snazší debugování
- Opravena logika pro určení aktivního hráče

### Changed
- Přepracována komponenta GameScene pro podporu online multiplayeru
- Odstraněna lokáln herní logika
- Přidána podpora pro zobrazení stavu hry ze serveru
- Implementováno omezení akcí podle aktuálního stavu hry
- Vylepšeno zobrazení stavu tahu a disabled stavů

### Added
- Implementována drag & drop logika pro hraní karet a útoky v online režimu
- Přidáno zobrazení stavu many a balíčku pro oba hráče
- Přidána vizuáln indikace aktivního hráe

### Fixed
- Opraveno zobrazování karet protivníka na herním poli - nyní jsou viditelné
- Přidáno správné načítání a zobrazování obrázků karet
- Opraveno zobrazení rubu karet pouze pro karty v ruce protivníka

### Added
- Přidána mapa obrázků karet pro správné přiřazení obrázků ke kartám

### Changed
- Upravena funkce getPlayerView pro posílání informací o kartách v ruce protihráče
- Implementováno bezpečné sdílení informací - protihráčovy karty v ruce jsou skryté

### Security
- Přidáno bezpečnostní opatření proti podvádění - klient nevidí detaily karet v ruce protihráče

### Fixed
- Opraveno odesílání stavu karet v ruce protihráče ze serveru
- Přidány chybějící vlastnosti pro skryté karty protihráče
- Vylepšena struktura GameManager třídy pro správnou práci s herním stavem
- Opraveno zobrazování počtu karet v ruce protihráče

### Security
- Vylepšeno skrývání informací o kartách protihráče - přidány pouze nezbytné vlastnosti

### Changed
- Vylepšen design matchmaking obrazovky
  - Přidáno elegantní gradientové pozadí
  - Přidány animované efekty pro lepší vizuální dojem
  - Implementován světelný efekt ve středu obrazovky

### Fixed
- Opraven útok na nepřátelského hrdinu
  - Upravena struktura dat odesílaných na server při útoku
  - Sjednoceno rozhraní pro útok na jednotky a hrdiny
  - Přidány chybějící parametry pro správné zpracování útoku
- Opraveno zobrazování obrázků hrdinů - nyní se správně rozlišuje hrdina hráče a protivníka

### Fixed
- Opraven problém s detekc konce hry při zabití hrdiny
- Přidána správná kontrola konce hry po každém útoku na hrdinu
- Zajištěno správné ukončení hry při dosažení nulových nebo záporných životů hrdiny

### Fixed
- Vylepšena detekce konce hry
- Přidáno logování pro snazší debugování konce hry
- Opraveno zpracování herního stavu při konci hry

### Fixed
- Implementována kontrola Taunt efektu
  - Jednotky musí nejprve zničit nepřátelské jednotky s Taunt
  - Nelze útočit na hrdinu, pokud má protihráč jednotku s Taunt
- Opravena funkčnost kouzel
  - Implementován efekt Fireball (6 poškození)
  - Implementován efekt The Coin (+1 mana)
  - Implementován efekt Nimble Sprite (líznutí karty)
  - Implementován efekt Healing Touch (léčení 6 životů)
  - Implementován efekt Arcane Intellect (líznutí 2 karet)
- Přidána kontrola mrtvých jednotek po efektech kouzel

### Fixed
- Opravena funkčnost kouzel
  - Přidáno správné cílení pro Fireball a Healing Touch
  - Implementovány vizuální notifikace pro všechny efekty kouzel
  - Opraveno lízání karet pro Arcane Intellect
- Implementovány efekty jednotek při vyložení
  - Water Elemental nyní správně zmrazí náhodnou nepřátelskou jednotku
  - Fire Elemental způsobuje poškození při vyložení
  - Nimble Sprite správně umožňuje líznout kartu

### Fixed
- Opraveno zobrazování notifikací na klientovi
  - Přidáno zpracování notifikací v GameScene komponentě
  - Implementováno správné zobrazování a odstraňování notifikací
- Opravena mechanika zmrazení jednotek
  - Jednotky nyní zůstávají zmražené celé kolo
  - Přidán systém dvou-kolového zmrazení
  - Opraveno rozmrazování jednotek na začátku druhého kola

### Fixed
- Opravena chyba při zobrazování notifikací
  - Opraveno zpracování jednotlivých notifikací
  - Přidána správná animace pro objevení a zmizení notifikací
  - Vylepšen vizuální styl notifikací

### Fixed
- Opraven import Notification komponenty
  - Sjednocen způsob exportu a importu komponenty
  - Přidána podpora pro named i default export

### Fixed
- Opraveno zobrazování notifikací
  - Zjednodušena struktura notifikací pro lepší zpracování
  - Opraveno předávání notifikací mezi serverem a klientem
  - Vylepšeno filtrování notifikací pro jednotlivé hráče

### Changed
- Přesunut shared modul do samostatného repozitáře
- Implementovány Git submoduly pro správu shared kódu
- Aktualizovány deployment skripty pro podporu submodulů

### Fixed
- Opraven build na Vercelu
  - Přidáno CI=false pro ignorování varování při buildu
  - Upraveny verze React závislostí
  - Aktualizována konfigurace Vercelu

### Fixed
- Opraveno načítání obrázku pozadí na Vercelu
  - Přidána správná konfigurace pro servírování statických souborů
  - Upraven path k obrázku pozadí pro použití PUBLIC_URL
  - Přidána explicitní route pro background.png v Vercel konfiguraci

### Fixed
- Opraveno lokální připojení k serveru
  - Přidána podpora pro oba transportní protokoly (websocket a polling)
  - Rozšřena CORS konfigurace pro lokální vývoj
  - Přidáno debug logování pro Socket.IO chyby
  - Upraveny environment proměnné pro různá prostředí

### Fixed
- Opravena viditelnost karet během přetahování
  - Implementován React Portal pro přetahované karty
  - Upraveno pozicování a z-index pro zajištění viditelnosti
  - Vylepšena vizuální zpětná vazba bhem přetahování

### Fixed
- Opravena chyba při načítání GameScene komponenty když není dostupný herní stav
- Přidány bezpečnostní kontroly pro práci s gameState
- Vylepšena validace tahů v online režimu
- Opraveny texty pro zobrazení vítěze v online režimu
- Přidána robustnější implementace Taunt mechaniky

### Changed
- Upravena GameScene komponenta pro práci s novou strukturou herního stavu
- Implementováno správné zobrazování skrytých karet protihráče
- Vylepšena logika pro určení aktivního hráče a vítěze

### Fixed
- Opraveno zobrazování počtu karet v balíčku
- Upraveny kontroly pro validní tahy v online režimu
- Opraveno zobrazování stavu hry pro oba hráče

### Fixed
- Opraveno zobrazování obrázků karet
  - Přidána mapa pro mapování názvů obrázk na importované soubory
  - Implementována fallback hodnota pro případ chybějícího obrázku
  - Vylepšeno zpracování obrázků karet ze serveru

### Fixed
- Opraven útok na nepřátelského hrdinu a jednotky
  - Přidána hluboká kopie herního stavu pro prevenci mutací
  - Implementováno podrobné logování průběhu útoku
  - Opraveno odečítání životů při útoku
  - Přidány dodatečné kontroly existence jednotek

### Added
- Přidáno podrobné logování na serveru
  - Logování průběhu útoku a soubojů
  - Sledování změn zdraví jednotek a hrdinů
  - Logování kontrol Taunt efektu

### Fixed
- Opravena chyba s cyklickými referencemi při kopírování herního stavu
  - Implementována bezpečná metoda pro kopírování stavu
  - Odstraněno použití JSON.stringify/parse
  - Zachována funkčnost kopírování herního stavu bez socket objektů

### Changed
- Upravena funkčnost kouzel
  - Fireball nyní cílí pouze na nepřátelského hrdinu (6 poškození)
  - Lightning Bolt nyní cílí pouze na nepřátelského hrdinu (3 poškození)
  - Healing Touch nyní léčí pouze vlastního hrdinu (8 životů)

### Added
- Přidáno podrobné logování efektů kouzel
  - Sledování změn zdraví a many
  - Logování počtu ovlivněných jednotek
  - Detailní informace o líznutých kartách

### Fixed
- Opraveny limity pro léčení a manu
  - Maximální zdraví hrdiny omezeno na 30
  - Maximální mana omezena na 10
- Vylepšeny notifikace pro kouzla

### Fixed
- Opraveno zobrazování notifikací pro Taunt efekt
  - Přidáno zpracování serverových notifikací na klientovi
  - Odstraněny duplicitní notifikace na klientovi
  - Vylepšeno zobrazování varování při neplatných útocích

### Fixed
- Opraveno zobrazování notifikací
  - Přidána podpora pro různé formáty notifikací
  - Vylepšena kontrola cílového hráče pro notifikace
  - Přidáno logování pro debugování notifikací

### Fixed
- Opraveno zobrazování notifikací
  - Upravena Notification komponenta pro podporu více notifikací
  - Přidána podpora pro zobrazení více notifikací současně
  - Vylepšena animace a styling notifikací
  - Opraveno mapování notifikací v UI

### Fixed
- Opraveno opakované zobrazování notifikací
  - Přidáno sledování ID poslední notifikace
  - Implementována kontrola pro nové notifikace
  - Vylepšena detekce změn v notifikacích
  - Přidáno logování pro sledování zpracování notifikací

### Fixed
- Opraven problém s duplicitním zpracováním útoku
  - Přidány kontroly pro prevenci vícenásobného útoku
  - Vylepšeno logování pro sledování požadavků na útok
  - Přidány dodatečné validace herního stavu

### Fixed
- Odstraněna duplicitní registrace socket event listenerů
  - Přesunuty všechny herní event listenery do GameManager.js
  - Ponechány pouze základní listenery v server.js
  - Opraveno dvojité zpracování herních akcí

### Fixed
- Opraveno cílení notifikací
  - Přidáno správné určení cílového hráče pro všechny herní efekty
  - Upraveny notifikace pro efekty jednotek
  - Sjednocen formát notifikací napříč celou aplikací

### Added
- Implementován efekt jednotky Arcane Familiar - při zahrání kouzla získává +1 útok

### Fixed
- Opraveno pozicování tooltipů
  - Přidána responzivní úprava pro menší obrazovky
  - Zkráceny texty tooltipů pro lepší čitelnost
  - Zajištěno, že tooltip nepřeteče mimo obrazovku

### Changed
- Přeloženy všechny herní notifikace do angličtiny pro konzistentní jazykové prostředí
  - Upraveny notifikace pro efekty kouzel
  - Upraveny notifikace pro efekty jednotek
  - Upraveny systémové notifikace (nedostatek many, plné pole, atd.)

### Changed
- Přeloženy všechny texty v MatchmakingScreen do angličtiny
  - "Hledání protihráče..." -> "Searching for opponent..."
  - "Zrušit hledání" -> "Cancel search"
  - "Najít hru" -> "Find game"
- Přeloženy všechny notifikace v combat logice do angličtiny
  - Upraveny chybové zprávy při útoku
  - Upraveny notifikace pro Taunt efekt
  - Sjednocen jazyk všech herních zpráv

### Changed
- Přeloženy všechny texty v GameScene do angličtiny
  - "Čekám na připojení protihráče..." -> "Waiting for opponent..."
  - "Hra skončila!" -> "Game Over!"
  - "Vyhrál jsi!" -> "You won!"
  - "Prohrál jsi!" -> "You lost!"
  - "Nejsi na tahu!" -> "Not your turn!"
  - "Nedostatek many!" -> "Not enough mana!"
  - "Tato jednotka nemůže útočit!" -> "This unit cannot attack!"
  - "Ukončit tah" -> "End turn"

### Changed
- Upraven počet karet v balíčku na standardních 30 karet
  - Přidány další kopie základních jednotek (3 kopie každé)
  - Přidány další kopie běžných kouzel (3 kopie)
  - Ponechány limitované kopie vzácnějších kouzel (1-2 kopie)
  - Zachována vyváženost balíčku pomocí různého počtu kopií podle vzácnosti

### Changed
- Upravena inicializace balíčku v GameManager.js
  - Implementován systém kopií karet podle vzácnosti
  - Přidáno logování pro kontrolu složení balíčku
  - Zachována funkcionalita unikátních ID pro karty

### Changed
- Upravena logika zmražených jednotek - jednotky se nyní rozmrazí na začátku tahu svého vlastníka místo o kolo později
- Odstraněn systém dvou-kolového rozmrazování (frozenLastTurn)

### Fixed
- Opravena logika zmražených jednotek - jednotky nyní zůstanou zmražené během následujícího kola vlastníka a poté se rozmrazí
- Obnoven systém dvou-kolového rozmrazování (frozenLastTurn) pro správnou funkčnost efektu zmražení

### Fixed
- Opravena logika zmražených jednotek - jednotky jsou nyní zmražené pouze do konce svého následujícího tahu
- Vylepšen systém rozmrazování pro přesnější časování efektu zmražení

### Fixed
- Opravena logika zmražených jednotek:
  - Jednotky jsou nyní zmražené pouze během svého následujícího tahu
  - Jednotky se rozmrazí na začátku následujícího tahu protivníka
  - Vylepšena přesnost časování efektu zmražení

### Fixed
- Opraveno duplicitní přidávání zpráv do Combat Logu
  - Přidáno mazání combatLogMessage po odeslání stavu hry klientům
  - Zamezeno duplicitnímu zobrazování stejných zpráv na klientovi
  - Vylepšena synchronizace Combat Logu mezi serverem a klientem

### Security
- Implementováno zabezpečení pomocí JWT tokenů
- Přidány Row Level Security policies pro Supabase
- Zabezpečení Socket.IO spojení
