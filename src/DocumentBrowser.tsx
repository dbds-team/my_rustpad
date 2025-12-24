import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from "@chakra-ui/react";
import { VscFile, VscTrash } from "react-icons/vsc";

type DocumentBrowserProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument: (id: string) => void;
  currentDocId: string;
};

function DocumentBrowser({
  isOpen,
  onClose,
  onSelectDocument,
  currentDocId,
}: DocumentBrowserProps) {
  const getDocuments = () => {
    const docs: { id: string; content: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("doc_")) {
        const id = key.substring(4);
        const content = localStorage.getItem(key) || "";
        docs.push({ id, content });
      }
    }
    return docs;
  };

  const deleteDocument = (id: string) => {
    localStorage.removeItem(`doc_${id}`);
    if (id === currentDocId) {
      window.location.hash = "";
    }
  };

  const documents = getDocuments();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>My Documents</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {documents.length === 0 ? (
            <Text color="gray.500">No saved documents</Text>
          ) : (
            <List spacing={2}>
              {documents.map((doc) => (
                <ListItem
                  key={doc.id}
                  p={3}
                  borderWidth={1}
                  borderRadius="md"
                  _hover={{ bg: "gray.50" }}
                >
                  <HStack justify="space-between">
                    <HStack
                      flex={1}
                      cursor="pointer"
                      onClick={() => {
                        onSelectDocument(doc.id);
                        onClose();
                      }}
                    >
                      <Icon as={VscFile} />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontWeight="medium">{doc.id}</Text>
                        <Text fontSize="sm" color="gray.500" noOfLines={1}>
                          {doc.content.substring(0, 50) || "(empty)"}
                        </Text>
                      </VStack>
                    </HStack>
                    <IconButton
                      aria-label="Delete document"
                      icon={<VscTrash />}
                      size="sm"
                      colorScheme="red"
                      variant="ghost"
                      onClick={() => deleteDocument(doc.id)}
                    />
                  </HStack>
                </ListItem>
              ))}
            </List>
          )}
          <Button mt={4} width="100%" onClick={onClose}>
            Close
          </Button>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default DocumentBrowser;
