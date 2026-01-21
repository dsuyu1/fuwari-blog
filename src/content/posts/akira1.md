---
title: "Part 1: Akira Ransomware Binary Analysis"
published: 2026-1-19T00:00:00-08:00
tags: [Ghidra, Digital Forensics, Reverse Engineering, Ransomware]
description: "A technical analysis of the binary structure of the Akira ransomware variant."
category: Cybersecurity
image: /akira.jpg
draft: false
---

<div align="center">

<small> _Akira_ is a 1988 Japanese animated cyberpunk action film. </small>

</div align="center">


# Introduction
In this post, I'll be documenting the first part of my technical analysis of the Akira ransomware variant. I'll be using [this](https://github.com/MottaSec/akira-ransomware-reverse) report as my guide. The report is extremely thorough, but it is also highly technical and not especially beginner friendly. In this series, I aim to document how I arrived at similar conclusions and to expand on what we can take away from those findings. Rather than providing a complete or authoritative analysis, my goal is to show the learning process itself. Through this series, I hope to deepen my own understanding of how ransomware operates at a highly technical level, while also demonstrating how others can reach the same conclusions independently, without relying on step-by-step guides. Ideally, this report will serve as inspiration for readers to begin their own reverse engineering journeys. 

I also recommend looking at these supplementary materials as well if you are curious:

- [Arete Akira Technical Analysis](https://areteir.com/static/bbdda35a1cc631e53cd929e075af873f/Malware-Spotlight-Akira-Ransomware.pdf)
- [CISA Akira Report](https://www.cisa.gov/news-events/cybersecurity-advisories/aa24-109a)

Reverse engineering is a fascinating area of cybersecurity. It plays an important role in digital forensics and vulnerability research, but it is also valuable for red teams seeking to understand how systems can be compromised. In this series, however, we will examine malware through the lens of blue teams. How can we dismantle malware, identify its weaknesses, and use that knowledge to develop effective defenses? How can this process better equip us to combat ransomware? These are the questions I hope to explore.

## Setup
I'll be using a REMnux container via Docker on a Windows 11 machine. To run Ghidra from the REMnux Docker container, you'll need to set up X11 forwarding:

```bash
# On Linux/macOS with X11
docker run -it --rm \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v $(pwd):/samples \
  remnux/remnux-distro:focal \
  /bin/bash

# Then inside the container
ghidra
```

For Windows users with WSL2:

1. Install VcXsrv or X410
2. Start the X server
3. Set DISPLAY variable: `bashexport DISPLAY=host.docker.internal:0`

To follow along, please download the Akira sample here: [MalwareBazaar](https://bazaar.abuse.ch/sample/def3fe8d07d5370ac6e105b1a7872c77e193b4b39a6e1cc9cfc815a36e909904/)

Once you've opened the file in Ghidra, we can get started!

---

# 1. PE Structure, Imports, and Strings
## 1.1 PE Structure
The Akira sample has a standard PE structure, with `.text`, `.rdata`, `.data`, `.pdata`, `.rsrc`, and `.reloc` sections. We can use the Memory Map tool to find our PE sections.

![memory map](public/memorymap.png)

- `.text`: stores _executable_ code. Naturally, it makes up the largest part of the sample. This section houses the ransomware logic.
- `.rdata`: stands for _read-only_ data. It stores constant data, like strings (and importantly, the RSA public key).
- `.data`: initalized data. Think _global and static variables_.
- [`.pdata`](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format#the-pdata-section): the _exception table_. It contains information about the function entry (the function in which the executable starts) and _exception handling_ (for debugging).
- [`.rsrc`](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format#the-rsrc-section): contains resource directory tables and resource data. Resource directory trees hold icons, strings, menus, and images.
- [`.reloc`](learn.microsoft.com/en-us/windows/win32/debug/pe-formatF.data): contains the base relocation table. Relocation is a whole other thing, you can read more about it [here](https://0xrick.github.io/win-internals/pe7/). 

Microsoft has extensive documentation over all of these sections. Feel free to read up on them [here](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format).

## 1.2 Imports
Imports are important because they tell us what Windows APIs the program uses to do its evil. You can find imports in Ghidra under the Symbols Tree.

![imports](public/symboltree.png)

We can find some interesting ones, like:
- `shell32.dll`: provides `CommandLineToArgvW` and `ShellExecuteW` functions. This means we should keep an eye out for Powershell commands.
- `kernel32.dll`: the core Windows API. Provides functions like `CreateDirectoryW`, `CreateEventW`, `CreateFileW`, `DeleteFileW`, `TerminateProcess`, `WriteFile`, etc.

Interestingly, I did not find any cryptographic libraries, which means Akira uses its own custom code for key generation. 


## 1.3 Strings
We can look at the Defined Strings panel to see all the strings Ghidra was able to find. Since we're going to come back to strings later, we'll just identify a few.

- `powershell.exe -Command "Get-WmiObject Win32_Shadowcopy | Remove-WmiObject"`: Akira deletes shadow copies to prevent recovery. (at `1400ddf10`)
- We can read the ransom note itself as well at `1400fb0d0`:

```txt
TerminatedCString	"Hi friends,\r\nWhatever who you are and what your title is, if you're reading this it means the internal infrastructure of your company is fully or partially dead, all your backups - virtual, physical - everything that we managed to reach - are completely removed. Moreover, we have taken a great amount of your corporate data prior to encryption.\r\n\r\nATTENTION! Strictly prohibited:\r\n- Deleting files with .arika extension;\r\n- Replacing or renaming .arika and .akira files;\r\n- Using third party software to recover your systems.\r\nIf you violate these rules, we cannot guarantee a successful recovery.\r\n\r\nWell, for now let's keep all the tears and resentment to ourselves and try to build a constructive dialogue. We're fully aware of what damage we caused by locking your internal sources. At the moment, you have to know:\r\n\r\n1. Dealing with us you will save A LOT due to we are not interested in ruining you financially. We will study in depth your finance, bank & income statements, your savings, investments etc. and present our reasonable demand to you. If you have an active cyber insurance, let us know and we will guide you how to properly use it. Also, dragging out the negotiation process will lead to failing of the deal.\r\n2. Paying us you save your TIME, MONEY, EFFORTS and be back on track within 24 hours approximately. Our decryptor works properly on any files or systems, so you will be able to check it by requesting a test decryption service from the beginning of our conversation. If you decide to recover on your own, keep in mind that you can permanently lose access to some files or accidentally corrupt them - in this case we won't be able to help.\r\n3. The security report or the exclusive first-hand information that you will receive upon reaching an agreement is of great value, since NO full audit of your network will show you the vulnerabilities that we've managed to detect and use in order to get into, identify backup solutions and download your data.\r\n4. As for your data, if we fail to agree, we will try to sell personal information/trade secrets/databases/source codes - generally speaking, everything that has a value on the darkmarket - to multiple threat actors at once. Then all of this will be published in our blog - akiral2iz6a7qgd3ayp3l6yub7xx2uep76idk3u2kollpj5z3z636bad[.]onion.\r\n5. We're more than negotiable and will definitely find a way to settle this quickly and reach an agreement which will satisfy both of us.\r\n\r\nIf you're indeed interested in our assistance and the services we provide you can reach out to us following simple instructions:\r\n\r\n1. Install TOR Browser to get access to our chat room - torproject[.]org/download/.\r\n2. Paste this link - https://akiralkzxzq2dsrzsrvbr2xgbbu2wgsmxryd4csgfameg52n7efvr2id.onion/d/4323440794-MBUQJ .\r\n3. Use this code - 9654-AD-OHLE-GMXZ - to log into our chat.\r\n\r\nKeep in mind that the faster you will get in touch, the less damage we cause."
```

In the note, we're provided an onion link so we can send over our payment.

![The supposed Akira payment portal](https://www.ibm.com/content/adobe-cms/us/en/think/x-force/spotlight-akira-ransomware-x-force/jcr:content/root/table_of_contents/body-article-8/image_1856054718.coreimg.png/1763568548899/a-spotlight-on-akira-ransomware-from-x-force-incident-response-and-threat-intelligence-1.png)

We can also find an interesting extension: `.arika`. A typo? Maybe. In other reports, the files are encrypted with the `.akira` extension. I guess threat actors are humans as well.

If we double-click on the misspelled extension, we're taken to a _huuuuge_ function - 2165 lines long to be exact. We've found Akira's main encryption engine! We will go over this function (`FUN_1400b71a0`) later. 

# 2. Entry Point Analysis
We can use `objdump` to get some info on the file.

![objdump](public/objdump.png)

This tells us that this file is a Windows 64-bit executable with its **entry point** at address `0x000000014008dd38`. This is important. Let's find this address in Ghidra.

![entry point](public/entrypoint.png)

An **entry point** is the place where execution begins for a program. The entry point function is called `entry`, and has two functions inside:

1. `__security_init_cookie()`
2. `FUN_14008dbc4()`

Let's take a look at `__security_init_cookie()` first. Notably, as is standard with malware obfuscation, function names have been stripped. That's why we see generic function names like `FUN_14008dbc4()`. In the report, they rename this function to `startup_main_wrapper()`. I will explain why later.

## 2.1 `__security_init_cookie()`
All we need to do is Google this function name to learn what it does. [According to Microsoft](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/security-init-cookie?view=msvc-170):

```
The global security cookie is used for buffer overrun protection in code compiled with /GS (Buffer Security Check) and in code that uses exception handling. On entry to an overrun-protected function, the cookie is put on the stack, and on exit, the value on the stack is compared with the global cookie. Any difference between them indicates that a buffer overrun has occurred and causes immediate termination of the program.
```

Stack cookies provide protection against stack-based buffer overflows. Let's look at `FUN_14008dbc4()`.

## 2.2 `FUN_14008dbc4()`

![initialization function](public/startup.png)

If you have no idea what you're looking at, let's use what we _do_ have to our advantage and Google it. Within this function, other functions are called whose names aren't stripped:

1. `__scrt_initialize_crt`: This is a startup function. According to [Inferara](https://www.inferara.com/en/blog/c-runtime/):

```
The C runtime (CRT) is a collection of startup routines, initialization code, standard library support, and sometimes system call wrappers that form the environment in which a C program executes. 
```
`__scrt_initialize_crt` initializes the C runtime library and sets up the global variables and data structures used by the CRT ([according to these guys](https://medium.com/@naore32/beyond-the-main-unearthing-sneaky-functions-521f593ebeb3)).

Moving on, we see another function: `__scrt_acquire_startup_lock()`. If you've ever taken an operating systems course, locks should sound familiar. "A lock is an abstraction that allows at most one thread to own it at a time. Holding a lock is how one thread tells other threads: 'I'm changing this thing, don’t touch it right now'" ([from MIT](https://web.mit.edu/6.005/www/fa15/classes/23-locks/)).

Here's the complete `FUN_14008dbc4()` function. Don't worry about understanding every line yet:

<details>
<summary>Click to expand full function code</summary>

```c
/* WARNING: Function: _guard_dispatch_icall replaced with inject ion: guard_dispatch_icall */

ulonglong FUN_14008dbc4(void)

{
  code *pcVar1;
  bool bVar2;
  uint uVar3;
  undefined8 uVar4;
  undefined8 uVar5;
  longlong *plVar6;
  ulonglong uVar7;
  ulonglong *puVar8;
  undefined8 unaff_RBX;
  
  uVar3 = (uint)unaff_RBX;
  uVar4 = __scrt_initialize_crt(1);
  if ((char)uVar4 == '\0') {
    FUN_14008e30c(7);
  }
  else {
    bVar2 = false;
    uVar4 = __scrt_acquire_startup_lock();
    uVar3 = (uint)CONCAT71((int7)((ulonglong)unaff_RBX >> 8),( char)uVar4);
    if (DAT_140100ae8 != 1) {
      if (DAT_140100ae8 == 0) {
        DAT_140100ae8 = 1;
        uVar5 = _initterm_e((undefined8 *)&DAT_1400ce728,(und efined8 *)&DAT_1400ce770);
        if ((int)uVar5 != 0) {
          return 0xff;
        }
        _initterm((undefined8 *)&DAT_1400ce558,(undefined8 *)& DAT_1400ce720);
        DAT_140100ae8 = 2;
      }
      else {
        bVar2 = true;
      }
      __scrt_release_startup_lock((char)uVar4);
      plVar6 = (longlong *)FUN_14008e650();
      if ((*plVar6 != 0) && (uVar7 = FUN_14008d8a0((longlong)pl Var6), (char)uVar7 != '\0')) {
        (*(code *)*plVar6)(0);
      }
      puVar8 = (ulonglong *)FUN_14008e658();
      if ((*puVar8 != 0) && (uVar7 = FUN_14008d8a0((longlong)p uVar8), (char)uVar7 != '\0')) {
        _register_thread_local_exe_atexit_callback(*puVar8);
      }
      __scrt_get_show_window_mode();
      _get_narrow_winmain_command_line();
      uVar3 = FUN_14004d2b0();
      uVar7 = FUN_14008e49c();
      if ((char)uVar7 != '\0') {
        if (!bVar2) {
          _cexit();
        }
        __scrt_uninitialize_crt(true,'\0');
        return (ulonglong)uVar3;
      }
      goto LAB_14008dd25;
    }
  }
  FUN_14008e30c(7);
LAB_14008dd25:
  FUN_1400a0e04(uVar3);
  FUN_1400a0dbc(uVar3);
  pcVar1 = (code *)swi(3);
  uVar7 = (*pcVar1)();
  return uVar7;
}
```
</details>

We can identify two more startup functions that Ghidra has named for us: `_initterm_e` and `_initterm`.  These are functions used by the C runtime library to call the constructors of global and static objects in a program.

At this point, everything we have examined appears to be startup code. So far, we have only identified C Runtime (CRT) functions and routines related to program initialization. The CRT consists of startup logic, initialization routines, standard library support, and, in some cases, system call wrappers. Together, these components create the execution environment for a C program.

Our entry point has led us directly into this initialization code. As a result, this path should eventually guide us to the main() function, as illustrated in this diagram provided by Inferara:

```
        ┌─────────────────────┐
        │ Program Entry Point │  (Defined in crt1.o or crt0.o)
        │     _start()        │
        └──────────┬──────────┘
                   │
                   │ (1) Initialize environment, memory, etc.
                   │
        ┌──────────┴──────────┐
        │   crti.o (Prologue) │ 
        │  Calls constructors │
        └──────────┬──────────┘
                   │
                   │ (2) Jump to main()
                   │
        ┌──────────┴──────────┐
        │        main()       │
        └──────────┬──────────┘
                   │
                   │ (3) main returns
                   │
        ┌──────────┴──────────┐
        │   crtn.o (Epilogue) │
        │  Calls destructors  │
        └──────────┬──────────┘
                   │
                   │ (4) exit syscall
                   │
             ┌─────┴──────┐
             │   OS Exit  │
             └────────────┘
```

We should be able to find our `main()` function somewhere here. We need to find where the preparation of the executable ends. 

Let's apply some creative thinking. What do we usually need before running any program? When you run a program, what does it usually ask for? Parameters! A flag of some kind. Some _input_ from the command line! Let's take a closer look again to the end of the `FUN_14008dbc4()` function:

![Finding main](public/finding_main.png)

We see two interesting function calls just before `FUN_14004d2b0()`:

```c
__scrt_get_show_window_mode();
_get_narrow_winmain_command_line();
```

A quick Google search tells us these are Microsoft CRT functions that prepare command-line arguments for the program. Hmm, interesting.. Right after these calls, we see:

```c
uVar3 = FUN_14004d2b0(); 
```

The return value of `FUN_14004d2b0()` is stored in uVar3. Then, after this function completes, we see:

```c
uVar7 = FUN_14008e49c(); 
if ((char)uVar7 != '\0') {
    if (!bVar2) {
        _cexit();  
    }
    __scrt_uninitialize_crt(true,'\0');  // Cleanup CRT
    return (ulonglong)uVar3;  // Return the exit code
}
```

We see `__scrt_uninitialize_crt`. Doing a quick Google search, we learn that `__scrt_uninitialize_crt` is an internal function within the Microsoft Visual C++ Runtime (CRT) library used during the process termination or DLL unload phase to perform necessary cleanup operations. Hmm, why would we want to cleanup _after_ `FUN_14004d2b0()` executes? Maybe because it contains all the application code? 

Basically, what I'm trying to get at is the thought process of finding the `main()` function. Finding `__scrt_get_show_window_mode()` and `_get_narrow_winmain_command_line()` were the biggest hints; the `__scrt_uninitialize_crt` function was the cherry on top.

After renaming the function to something more descriptive, let's get into the _real_ analysis.

# 3. Analyzing `main()`
According to the MottaSec report, `main()` orchestrates the entire ransomware operation, and at first glance, that would appear to be the case. The function is around ~1360 lines of code. Don't get overwhelmed, however. Let's start by breaking down the function into sections. 

## 3.1 Initialization & Logging
The first ~233 lines are variable declarations.

![variables](public/variables.png)

The next few lines show evidence of creating log creation. Specfically, the formatting of time into strings for some sort of log timestamp.

```c
  local_38 = DAT_1400f9368 ^ (ulonglong)auStackY_bb8;
  _time64(&local_1e0);
  _Tm = _localtime64(&local_1e0); // format time to local time
  strftime(local_88,0x50,"Log-%d-%m-%Y-%H-%M-%S",_Tm); // format the time into a string. notice the "Log" word at the front. Seems like a timestamp for a log.
  ...
  ```

The next few sections involve the program's flow of execution.

## 3.2 Command Line Parsing

```c
  lpCmdLine = GetCommandLineW();
  hMem = CommandLineToArgvW(lpCmdLine,local_2c0);
  if (hMem == (LPWSTR *)0x0) { // if NULL
    local_b70 = (LPVOID)0x0;
    uStack_b68 = 0;
    local_b60 = 0;
    local_b58 = 0;
    FUN_1400376b0(&local_b70,(undefined8 *)"Command line to  argvW failed!",0x1d); // return an error
    ...
```
Notably, the arguments the program takes can be found as strings:

![command line arguments](public/commandlineargs.png)

Remember, Akira is itself a program meant to be executed by somebody or something. It makes sense that it would take argument parameters to affect its execution. The arguments it takes includes:

- --encryption_path
- --encryption_percent
- --exclude
- --share_file
- -dellog
- -ep bypass -Command
- -localonly

## 3.3 Configuration Validation
If the user specified specific arguments, this is where they would get set. Otherwise, Akira moves on with defaults:

```c
// Validate encryption_percent argument
if (encryption_percent_str != NULL) {
    errno_ptr = __doserrno();
    *errno_ptr = 0;

    // Convert string to integer
    encryption_percent = wcstol(encryption_percent_str, &endptr, 10);

    // Check if conversion was successful
    if (endptr == encryption_percent_str) {
        // No digits were converted - use default
        encryption_percent = 50;
    }

    // Check for range error
    if (*errno_ptr == ERANGE) {
        encryption_percent = 50;
    }
} else {
    // Default encryption percentage
    encryption_percent = 50;
}

// Validate range (1-100)
if (encryption_percent < 1 || encryption_percent > 100) {
    encryption_percent = 50;  // Reset to default
}
```

<small> This code snippet was taken from [here](https://github.com/MottaSec/akira-ransomware-reverse/blob/main/docs/technical/01_binary_analysis_initialization.md).</small>


## 3.4 System Enumeration & Thread Allocation
Around line ~700 we can find program call the `GetSystemInfo` function from `kernel32.dll` (core Windows API). Akira looks for how many CPUs are available to it, then decides how to divvy up the encryption threads.

```c
...
      GetSystemInfo(&local_b8);
      if (local_b8.dwNumberOfProcessors == 0) {
        local_b70 = (LPVOID)0x0;
        uStack_b68 = 0;
        local_b60 = 0;
        local_b58 = 0;
        FUN_1400376b0(&local_b70,(undefined8 *)"No cpu availa ble!",0x11);
        if ((DAT_140102188 != (longlong *)0x0) &&
           (FUN_140040440(DAT_140102188,4,&local_b70), DAT_1 40102188 != (longlong *)0x0)) {
          (**(code **)(*DAT_140102188 + 0x18))();
        }
        if (0xf < local_b58) {
          pvVar31 = local_b70;
          if ((0xfff < local_b58 + 1) &&
             (pvVar31 = *(LPVOID *)((longlong)local_b70 + -8),
             0x1f < (ulonglong)((longlong)local_b70 + (-8 - (longlon g)pvVar31)))) {
            FUN_14009513c();
            pcVar6 = (code *)swi(3);
            (*pcVar6)();
            return;
          }
          goto LAB_14004ef47;
        }
      }
      else {
        puVar19 = (undefined8 *)operator_new(0x38);
        *puVar19 = 0;
        puVar19[1] = 0;
        puVar19[2] = 0;
        puVar19[3] = 0;
        puVar19[4] = 0;
        puVar19[5] = 0;
        puVar19[6] = 0;
        puVar22 = FUN_140083620((undefined4 *)puVar19);
        local_a30 = puVar22;
        if (puVar22 != (undefined4 *)0x0) {
          uVar14 = FID_conflict:atoi(&DAT_1400fb080);
          uVar36 = CONCAT71((int7)((ulonglong)_Tm >> 8),1);
          uVar23 = FUN_140084210((longlong)puVar22,(ulonglong )uVar14,0x1400fa080,'\x01');
          if ((int)uVar23 == 0) {
            FUN_140036fc0();
            if ((int)local_b8.dwNumberOfProcessors < 5) {
              if (local_b8.dwNumberOfProcessors == 1) {
                local_b8.dwNumberOfProcessors = 2;
              }
              local_b8.dwNumberOfProcessors = local_b8.dwNumber OfProcessors * 2;
            }
            local_b30 = (int)(local_b8.dwNumberOfProcessors * 0x1 e) / 100;
            local_b78[0] = (int)(local_b8.dwNumberOfProcessors * 1 0) / 100;
            if (local_b78[0] == 0) {
              local_b78[0] = 1;
            }
            local_b2c = (local_b8.dwNumberOfProcessors - local_b3 0) - local_b78[0];
            local_388 = puVar22;
            puVar19 = (undefined8 *)FUN_14003e800(local_7e8,&l ocal_b30);
            plVar27 = local_808;
            puVar19 = FUN_14003e3f0(plVar27,(undefined8 *)"Num ber of thread to folder parsers = ",
                                    puVar19,uVar36);
            FUN_1400427f0(plVar27,puVar19);
            FUN_1400371b0(local_808);
            FUN_1400371b0(local_7e8);
            pcVar24 = (char *)FUN_14003e800((longlong *)local_89 8,local_b78);
            lVar20 = *(longlong *)(pcVar24 + 0x10);
            if (*(ulonglong *)(pcVar24 + 0x18) - lVar20 < 0x2a) {
              pcVar24 = (char *)FUN_1400405f0((undefined8 *)pcVa r24,0x2a,lVar20,uVar36,
                                              (undefined8 *)
                                              "Number of thread to root folder p arsers = ",0x2a);
            }
            else {
              *(longlong *)(pcVar24 + 0x10) = lVar20 + 0x2a;
              pcVar38 = pcVar24;
              if (0xf < *(ulonglong *)(pcVar24 + 0x18)) {
                pcVar38 = *(char **)pcVar24;
              }
              if ((" " < pcVar38) ||
                 (pcVar38 + lVar20 < "Number of thread to root folde r parsers = ")) {
                pcVar37 = (char *)0x2a;
              }
              else if ("Number of thread to root folder parsers = " < pcVar38) {
                pcVar37 = pcVar38 + -0x1400dd1b8;
              }
              else {
                pcVar37 = (char *)0x0;
              }
              FUN_14008fdc0((undefined8 *)(pcVar38 + 0x2a),(und efined8 *)pcVar38,lVar20 + 1);
              FUN_14008fdc0((undefined8 *)pcVar38,
                            (undefined8 *)"Number of thread to root fold er parsers = ",
                            (ulonglong)pcVar37);
              FUN_14008fdc0((undefined8 *)(pcVar38 + (longlong)p cVar37),
                            (undefined8 *)(pcVar37 + 0x1400dd1e2),0x2 a - (longlong)pcVar37);
            }
...
```
The purpose of this section is to optimize CPU resources for the crypto engine. Here's the C version of the above logic:

```c
// Get CPU count
cpu_count = system_info.dwNumberOfProcessors;

// Boost thread count for systems with few CPUs
if (cpu_count < 5) {
    if (cpu_count == 1) {
        cpu_count = 2;  // Single core becomes 2 threads
    }
    cpu_count = cpu_count * 2;  // Double for small systems
}

// Calculate thread allocation
folder_parser_threads = (cpu_count * 30) / 100;  // 30% for folder parsing
root_folder_threads = (cpu_count * 10) / 100;    // 10% for root parsing

// Ensure at least 1 root folder thread
if (root_folder_threads == 0) {
    root_folder_threads = 1;
}

// Remaining threads for encryption
encryption_threads = cpu_count - folder_parser_threads - root_folder_threads;

// Log thread allocation
log_info("Number of thread to folder parsers = %d", folder_parser_threads);
log_info("Number of thread to root folder parsers = %d", root_folder_threads);
log_info("Number of threads to encrypt = %d", encryption_threads);
```

## 3.5 Crypto Engine Initialization
![Crypto Engine Function Graph](public/process_tree_cryptoengine.png)

<div align="center">

<small> This function is huge! </small>

</div align="center">

We'll tackle the cryptography in the next post.

# Conclusion
In this first part of our Akira ransomware analysis, we've successfully mapped out the binary's structure and traced the execution flow from entry point to the main encryption orchestration logic. We've identified several key components that reveal how Akira operates:
Key Findings:

- Standard PE structure with _custom_ cryptographic implementation (no imported crypto libraries)
- Sophisticated multi-threaded architecture that dynamically allocates CPU resources
- Command-line argument parsing for operational flexibility
- Evidence of logging mechanisms for tracking execution
- Shadow copy deletion via PowerShell to prevent recovery


In Part 2, we'll dive deep into that massive FUN_1400b71a0() function we spotted - the 2165-line encryption engine. We'll analyze:

- The custom cryptographic implementation
- How the RSA public key in .rdata is used
- The ChaCha20 stream cipher implementation
- File selection and partial encryption logic

What's most interesting about Akira is that it implements its own cryptography without using standard libraries. This helps obfuscation, preventing EDRs from intercepting API calls, but leads to implementation flaws, as we'll see soon. 