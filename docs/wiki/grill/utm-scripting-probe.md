# UTM scripting: результаты ручной проверки

Создано: 2026-07-27

Статус: закрывает раздел «Непроверенная зависимость» из [issue #29](https://github.com/yardencom/openstrap/issues/29).

Проверено на: UTM 4.7.5 (`com.utmapp.UTM`, не App Store, sandboxed), macOS Darwin 25.5.0, Apple Silicon (arm64).

## Что подтвердилось

1. **У `utmctl` нет подкоманды `create`.** Доступны `version`, `list`, `status`, `start`, `suspend`, `stop`, `attach`, `file`, `exec`, `ip-address`, `clone`, `delete`, `usb`. Совпадает с тем, что записано в issue.

2. **`make` создает машину.** Возвращает id:

   ```applescript
   tell application "UTM"
     make new virtual machine with properties {backend:qemu, configuration:{name:"x", architecture:"aarch64"}}
   end tell
   ```

3. **`make` принимает скалярную часть конфигурации целиком.** Проверено одним вызовом: `name`, `architecture`, `memory`, `cpu cores`, `uefi`, `hypervisor`. Досылать их отдельной командой не нужно.

4. **Значения по умолчанию:** `memory` 512, `cpu cores` 0, `uefi` true, `hypervisor` true. После `make` машина уже имеет два диска (removable USB и VirtIO) и один сетевой интерфейс в режиме `shared` с пустым списком проброса портов.

5. **`update configuration` работает для скалярных свойств.** `update configuration vm with {memory:3072}` применяется.

## Что опровергнуто

6. **Вложенные коллекции через scripting не устанавливаются.** Ни `drives`, ни `network interfaces` не принимаются - ни в `make`, ни в `update configuration`, ни из AppleScript, ни из JXA. Ошибка одна и та же:

   ```
   Can't make {network interfaces:{{index:0, mode:shared, port forwards:{{protocol:TCP, host port:2222, guest port:22}}}}}
   into type qemu configuration or apple configuration. (-1700)
   ```

   Проверены варианты: список литералов, запись собранная переменными, чтение конфигурации целиком с правкой и обратной записью, JXA с точными именами полей из `vm.configuration()`, регистр перечислителя `TCP` и `tcp`, режимы `shared` и `emulated`. Результат одинаковый.

   **Следствие: проброс порта через scripting API недоступен, хотя `qemu port forward` объявлен в `UTM.sdef`.** Таблица «Что покрывает API UTM» в issue #29 в строке «проброс порта» неверна: свойство объявлено, но не устанавливается.

7. **Scripting требует открытого главного окна.** Пока у приложения ноль окон, любая мутирующая команда падает с `UTM is not ready to accept commands. (-2700)`, при том что чтение (`get name of every virtual machine`) работает. Лечится `open -a UTM` перед вызовом; после этого `count of windows` равен 1 и `make` проходит.

   Это не задокументировано и обнаруживается только экспериментом. Провайдер обязан обеспечивать открытое окно перед созданием машины.

## Что это меняет в плане

Доступ к гостю по SSH нельзя строить на проброшенном порту, полученном через scripting. Остаются варианты, и выбор между ними - незакрытое решение:

| Вариант | Чего стоит |
|---|---|
| `utmctl ip-address` и прямое подключение к IP гостя в сети `shared` | ровно то, что issue называл недостатком бэкенда `apple`. IP выдается DHCP и меняется, гость должен успеть подняться |
| Правка `config.plist` внутри пакета `.utm` до первого запуска | обход официального API, ломается при смене формата UTM |
| ~~`qemu additional arguments`~~ | **проверено, не работает** |

`qemu additional arguments` - тоже список записей, и он не устанавливается. Хуже: `update configuration` с ним не падает, а молча ничего не делает, после чего чтение свойства возвращает ошибку `-1728`. Молчаливый no-op опаснее ошибки, потому что машина создается выглядящей настроенной.

Итог: **через scripting UTM не устанавливается ни одна коллекция.** Из трех вариантов доступа остаются два, и оба - вне официального API либо вне проброса портов.

## Как воспроизвести

```bash
open -a UTM
osascript -e 'tell application "UTM" to make new virtual machine with properties {backend:qemu, configuration:{name:"probe", architecture:"aarch64", memory:2048, cpu cores:2}}'
/Applications/UTM.app/Contents/MacOS/utmctl list
/Applications/UTM.app/Contents/MacOS/utmctl delete <UUID>
```
