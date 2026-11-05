import { driveStatus, findRoomByName, getClientStudio, nextBestSlot } from "@bolo/core";
import { CreateView } from "@/components/studio/create-view";

export default async function CreatePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { client } = getClientStudio(clientId);
  const drive = driveStatus();
  return (
    <CreateView
      client={client}
      defaultSlot={nextBestSlot(client)}
      drive={{ connected: drive.connected, folderUrl: drive.clients[clientId]?.references ?? null }}
      agentsRoomKnown={Boolean(findRoomByName(client.rooms.work))}
    />
  );
}
