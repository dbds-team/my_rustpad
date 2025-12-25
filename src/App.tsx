import { Box, Button, Flex, HStack, Icon, Text, useToast } from "@chakra-ui/react";
import Editor from "@monaco-editor/react";
import { editor } from "monaco-editor/esm/vs/editor/editor.api";
import { useEffect, useRef, useState } from "react";
import { VscChevronRight, VscFolderOpened, VscGist } from "react-icons/vsc";
import useLocalStorageState from "use-local-storage-state";

import rustpadRaw from "../rustpad-server/src/rustpad.rs?raw";
import DocumentBrowser from "./DocumentBrowser";
import Footer from "./Footer";
import ReadCodeConfirm from "./ReadCodeConfirm";
import SaveDialog from "./SaveDialog";
import Sidebar from "./Sidebar";
import animals from "./animals.json";
import languages from "./languages.json";
import Rustpad, { UserInfo } from "./rustpad";
import useHash from "./useHash";

function getWsUri(id: string) {
  let url = new URL(`api/socket/${id}`, window.location.href);
  url.protocol = url.protocol == "https:" ? "wss:" : "ws:";
  return url.href;
}

function generateName() {
  return "Anonymous " + animals[Math.floor(Math.random() * animals.length)];
}

function generateHue() {
  return Math.floor(Math.random() * 360);
}

function App() {
  const toast = useToast();
  const [language, setLanguage] = useState("plaintext");
  const [connection, setConnection] = useState<
    "connected" | "disconnected" | "desynchronized"
  >("disconnected");
  const [users, setUsers] = useState<Record<number, UserInfo>>({});
  const [name, setName] = useLocalStorageState("name", {
    defaultValue: generateName,
  });
  const [hue, setHue] = useLocalStorageState("hue", {
    defaultValue: generateHue,
  });
  const [editor, setEditor] = useState<editor.IStandaloneCodeEditor>();
  const [darkMode, setDarkMode] = useLocalStorageState("darkMode", {
    defaultValue: false,
  });
  const rustpad = useRef<Rustpad>();
  const id = useHash();

  const [readCodeConfirmOpen, setReadCodeConfirmOpen] = useState(false);
  const [docBrowserOpen, setDocBrowserOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [docName, setDocName] = useState(id);
  const [hasSaved, setHasSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (editor?.getModel()) {
      const model = editor.getModel()!;
      const savedContent = localStorage.getItem(`doc_${id}`);
      if (savedContent !== null) {
        model.setValue(savedContent);
      }
      model.setEOL(0); // LF
      rustpad.current = new Rustpad({
        uri: getWsUri(id),
        editor,
        onConnected: () => setConnection("connected"),
        onDisconnected: () => setConnection("disconnected"),
        onDesynchronized: () => {
          setConnection("desynchronized");
          toast({
            title: "Desynchronized with server",
            description: "Please save your work and refresh the page.",
            status: "error",
            duration: null,
          });
        },
        onChangeLanguage: (language) => {
          if (languages.includes(language)) {
            setLanguage(language);
          }
        },
        onChangeUsers: setUsers,
      });
      const saveInterval = setInterval(() => {
        localStorage.setItem(`doc_${id}`, model.getValue());
      }, 2000);

      const handlePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            e.preventDefault();
            const blob = items[i].getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = (event) => {
                const base64 = event.target?.result as string;
                const position = editor.getPosition();
                if (position) {
                  const text = language === "markdown" ? `![image](${base64})` : base64;
                  model.pushEditOperations(
                    editor.getSelections(),
                    [{ range: { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column }, text }],
                    () => null
                  );
                }
              };
              reader.readAsDataURL(blob);
            }
            break;
          }
        }
      };
      const editorDom = editor.getDomNode();
      if (editorDom) {
        editorDom.addEventListener("paste", handlePaste as any);
      }

      return () => {
        localStorage.setItem(`doc_${id}`, model.getValue());
        clearInterval(saveInterval);
        if (editorDom) {
          editorDom.removeEventListener("paste", handlePaste as any);
        }
        rustpad.current?.dispose();
        rustpad.current = undefined;
      };
    }
  }, [id, editor, toast, setUsers]);

  useEffect(() => {
    if (connection === "connected") {
      rustpad.current?.setInfo({ name, hue });
    }
  }, [connection, name, hue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const content = editor?.getModel()?.getValue() || "";
        if (!content.trim()) {
          toast({
            title: "Cannot save empty file",
            status: "warning",
            duration: 2000,
          });
          return;
        }
        if (!hasSaved || id.length < 10) {
          setDocName(id);
          setSaveDialogOpen(true);
        } else {
          localStorage.setItem(`doc_${id}`, content);
          toast({
            title: "Saved",
            status: "success",
            duration: 1000,
          });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, hasSaved, editor, toast]);

  function handleSaveDocument(name: string) {
    const content = editor?.getModel()?.getValue() || "";
    if (!content.trim()) {
      toast({
        title: "Cannot save empty file",
        status: "warning",
        duration: 2000,
      });
      setSaveDialogOpen(false);
      return;
    }
    if (name && name !== id) {
      localStorage.removeItem(`doc_${id}`);
      localStorage.setItem(`doc_${name}`, content);
      window.location.hash = name;
    }
    setHasSaved(true);
    setSaveDialogOpen(false);
  }

  function handleLanguageChange(language: string) {
    setLanguage(language);
    if (rustpad.current?.setLanguage(language)) {
      toast({
        title: "Language updated",
        description: (
          <>
            All users are now editing in{" "}
            <Text as="span" fontWeight="semibold">
              {language}
            </Text>
            .
          </>
        ),
        status: "info",
        duration: 2000,
        isClosable: true,
      });
    }
  }

  function handleLoadSample(confirmed: boolean) {
    if (editor?.getModel()) {
      const model = editor.getModel()!;
      const range = model.getFullModelRange();

      // If there are at least 10 lines of code, ask for confirmation.
      if (range.endLineNumber >= 10 && !confirmed) {
        setReadCodeConfirmOpen(true);
        return;
      }

      model.pushEditOperations(
        editor.getSelections(),
        [{ range, text: rustpadRaw }],
        () => null,
      );
      editor.setPosition({ column: 0, lineNumber: 0 });
      if (language !== "rust") {
        handleLanguageChange("rust");
      }
    }
  }

  function handleDarkModeChange() {
    setDarkMode(!darkMode);
  }

  return (
    <Flex
      direction="column"
      h="100vh"
      overflow="hidden"
      bgColor={darkMode ? "#1e1e1e" : "white"}
      color={darkMode ? "#cbcaca" : "inherit"}
    >
      <Box
        flexShrink={0}
        bgColor={darkMode ? "#333333" : "#e8e8e8"}
        color={darkMode ? "#cccccc" : "#383838"}
        textAlign="center"
        fontSize="sm"
        py={0.5}
      >
        Rustpad
      </Box>
      <Flex flex="1 0" minH={0}>
        <Sidebar
          documentId={id}
          connection={connection}
          darkMode={darkMode}
          language={language}
          currentUser={{ name, hue }}
          users={users}
          onDarkModeChange={handleDarkModeChange}
          onLanguageChange={handleLanguageChange}
          onLoadSample={() => handleLoadSample(false)}
          onChangeName={(name) => name.length > 0 && setName(name)}
          onChangeColor={() => setHue(generateHue())}
          onOpenDocBrowser={() => setDocBrowserOpen(true)}
        />
        <DocumentBrowser
          isOpen={docBrowserOpen}
          onClose={() => setDocBrowserOpen(false)}
          onSelectDocument={(docId) => (window.location.hash = docId)}
          currentDocId={id}
        />
        <SaveDialog
          isOpen={saveDialogOpen}
          onClose={() => setSaveDialogOpen(false)}
          onSave={handleSaveDocument}
          defaultName={docName}
        />
        <ReadCodeConfirm
          isOpen={readCodeConfirmOpen}
          onClose={() => setReadCodeConfirmOpen(false)}
          onConfirm={() => {
            handleLoadSample(true);
            setReadCodeConfirmOpen(false);
          }}
        />

        <Flex flex={1} minW={0} h="100%" direction="column" overflow="hidden">
          <HStack
            h={6}
            spacing={1}
            color="#888888"
            fontWeight="medium"
            fontSize="13px"
            px={3.5}
            flexShrink={0}
            justifyContent="space-between"
          >
            <HStack spacing={1}>
              <Icon as={VscFolderOpened} fontSize="md" color="blue.500" />
              <Text>documents</Text>
              <Icon as={VscChevronRight} fontSize="md" />
              <Icon as={VscGist} fontSize="md" color="purple.500" />
              <Text
                cursor="pointer"
                _hover={{ textDecoration: "underline" }}
                onClick={() => {
                  setDocName(id);
                  setSaveDialogOpen(true);
                }}
              >
                {id}
              </Text>
            </HStack>
            {language === "markdown" && (
              <Button
                size="xs"
                onClick={() => setShowPreview(!showPreview)}
                colorScheme={showPreview ? "blue" : "gray"}
              >
                {showPreview ? "Edit" : "Preview"}
              </Button>
            )}
          </HStack>
          <Box flex={1} minH={0}>
            {language === "markdown" && showPreview ? (
              <Box
                flex={1}
                p={4}
                overflow="auto"
                bgColor={darkMode ? "#1e1e1e" : "white"}
                dangerouslySetInnerHTML={{
                  __html: content
                    .replace(/!\[.*?\]\((data:image\/[^)]+)\)/g, '<img src="$1" style="max-width:100%"/>')
                    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                    .replace(/\n/g, '<br/>')
                }}
              />
            ) : (
              <Editor
                theme={darkMode ? "vs-dark" : "vs"}
                language={language}
                options={{
                  automaticLayout: true,
                  fontSize: 13,
                }}
                onMount={(editor) => setEditor(editor)}
                onChange={(value) => setContent(value || "")}
              />
            )}
          </Box>
        </Flex>
      </Flex>
      <Footer />
    </Flex>
  );
}

export default App;
