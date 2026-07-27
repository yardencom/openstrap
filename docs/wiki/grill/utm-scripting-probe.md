# UTM scripting: результаты ручной проверки

Создано: 2026-07-27

Статус: закрывает раздел «Непроверенная зависимость» из [issue #29](https://github.com/yardencom/openstrap/issues/29).

Проверено на: UTM 4.7.5 (`com.utmapp.UTM`, не App Store, sandboxed), macOS Darwin 25.5.0, Apple Silicon (arm64).

**Вывод: интерфейс провайдера из issue #29 подтверждается. Диски, сеть и проброс порта настраиваются через scripting.** Ранняя версия этого документа утверждала обратное - она была неверна, причина ошибки разобрана в конце.

## Что работает

1. **У `utmctl` нет подкоманды `create`.** Доступны `version`, `list`, `status`, `start`, `suspend`, `stop`, `attach`, `file`, `exec`, `ip-address`, `clone`, `delete`, `usb`. Машина создается командой AppleScript `make`.

2. **`make` принимает скалярную часть конфигурации целиком:** `name`, `architecture`, `memory`, `cpu cores`, `uefi`, `hypervisor`. Досылать их отдельно не нужно.

3. **Значения по умолчанию:** 512 MiB, 0 ядер, `uefi` on, `hypervisor` on, два диска и один интерфейс в режиме `shared`.

4. **`update configuration` ставит и скаляры, и коллекции** - и `drives`, и `network interfaces`.

5. **Диск подключается.** UTM импортирует файл в пакет `.utm` и конвертирует в qcow2:

   ```applescript
   update configuration vm with {drives:{{source:POSIX file "…/image.img", interface:VirtIO}}}
   ```

   В `config.plist` появляется `Drive: [{ImageName: "image.qcow2", Interface: "VirtIO", …}]`.

6. **Проброс порта работает.** Требует режима `emulated` - в `shared` его нет:

   ```applescript
   update configuration vm with {network interfaces:{{mode:emulated, port forwards:{{protocol:«constant ****TcPp», host port:2222, guest port:22}}}}}
   ```

   В `config.plist`: `PortForward: [{GuestPort: 22, HostPort: 2222, Protocol: "TCP"}]`.

## Две ловушки, которые видно только экспериментом

7. **Перечислители не резолвятся по имени.** `protocol:TCP` и `protocol:tcp` дают `-1700 Can't make … into type qemu configuration`. Работает только сырой код: `«constant ****TcPp»` (TCP) и `«constant ****UdPp»` (UDP). Коды перечислителей берутся из `UTM.sdef`.

   JXA не помогает: `protocol:"TCP"` там дает `Can't convert types (-1700)`. Провайдер обязан строить AppleScript с сырыми константами.

8. **Файл образа должен лежать внутри песочницы UTM.** UTM подписан с `app-sandbox`. Источник из `$HOME/…` или `/private/tmp/…` дает `The file couldn't be opened because it doesn't exist (-2700)`, хотя файл есть. Из `~/Library/Containers/com.utmapp.UTM/Data/Documents/` подключается.

   Следствие: кеш образов провайдера должен жить внутри контейнера UTM либо образ копируется туда перед подключением.

9. **Scripting требует открытого главного окна.** Пока окон ноль, любая мутирующая команда падает с `UTM is not ready to accept commands (-2700)`, при этом чтение работает. Лечится `open -a UTM`. Не задокументировано.

## Почему ранняя версия документа была неверна

Первый заход утверждал, что через scripting не устанавливается ни одна коллекция, и что проброса порта нет. Обе ошибки - следствие одной причины: перечислитель `TCP` не резолвился, а ошибка `-1700` указывала на всю запись целиком, а не на поле. Отсюда вывод «коллекция не принимается», хотя не принималось одно значение внутри нее.

Проверка, которую надо было сделать сразу и которая все разводит: поставить `network interfaces` **без** `port forwards`. Это проходит - значит коллекция принимается, и дело в содержимом.

`qemu additional arguments` действительно молча не применяется - это отдельный дефект, и на нем ничего строить нельзя. Но обходить его больше не нужно.

## Как воспроизвести

```bash
open -a UTM
C="$HOME/Library/Containers/com.utmapp.UTM/Data/Documents"
dd if=/dev/zero of="$C/test.img" bs=1048576 count=8

osascript -e "tell application \"UTM\" to make new virtual machine with properties {backend:qemu, configuration:{name:\"probe\", architecture:\"aarch64\", memory:2048, cpu cores:2}}"
# затем по id:
osascript -e "tell application \"UTM\" to update configuration virtual machine id \"<UUID>\" with {drives:{{source:POSIX file \"$C/test.img\", interface:VirtIO}}}"
osascript -e "tell application \"UTM\" to update configuration virtual machine id \"<UUID>\" with {network interfaces:{{mode:emulated, port forwards:{{protocol:«constant ****TcPp», host port:2222, guest port:22}}}}}"

/Applications/UTM.app/Contents/MacOS/utmctl delete <UUID>
```
