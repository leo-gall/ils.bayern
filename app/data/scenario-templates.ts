import type { IncidentSeverity } from '~/types/incident'
import type { VehicleType } from '~/types/station'
import type { LocationContext } from '~/utils/locationContext'
import type { FollowUpQuestion } from './caller-followups'

/**
 * Hand-authored incident vignettes (not fetched data): each is a hidden "ground
 * truth" a spawned incident draws from. The dispatcher never sees this text directly -
 * it surfaces as the caller's fixed opening statement and later as LLM radio context.
 */
export interface ScenarioTemplate {
  id: string
  keyword: string
  severity: IncidentSeverity
  requiredVehicleTypes: VehicleType[]
  /** Objective ground truth - clinical/complete, used as LLM radio context. Never spoken
   * verbatim by the caller (see callerStatement/followUps), real callers aren't this composed. */
  summary: string
  /** The caller's opening statement - lay, incomplete, urgent, but deliberately withholds
   * the details answered by followUps below. Real 112 callers don't dump everything in one
   * breath; the dispatcher has to actually ask. */
  callerStatement: string
  /** Answers to (potentially all 5 of) the shared generic follow-up questions (see
   * caller-followups.ts) - only revealed if/when the dispatcher clicks that question in
   * CallDialog, so a thorough dispatcher can build a genuinely complete picture. */
  followUps: Partial<Record<FollowUpQuestion, string>>
  /** Terrain(s) at the spawned point this vignette makes sense at - e.g. no Kellerbrand in the middle of a forest. */
  locationContexts: LocationContext[]
}

export const scenarioTemplates: ScenarioTemplate[] = [
  {
    id: 'rd-reanimation',
    keyword: 'RD Reanimation',
    severity: 'kritisch',
    requiredVehicleTypes: ['RTW', 'NEF'],
    summary: 'Ein 68-jähriger Mann ist beim Frühstück bewusstlos zusammengebrochen und atmet nicht mehr normal. Die Ehefrau hat mit der Reanimation begonnen.',
    callerStatement: 'Mein Mann ist einfach umgekippt, bitte kommen Sie schnell!',
    followUps: {
      'Was ist genau passiert?': 'Er ist beim Frühstück auf einmal zusammengebrochen und reagiert nicht mehr richtig!',
      'Ist jemand verletzt oder in Gefahr?': 'Er atmet nicht richtig, ich glaub er atmet gar nicht mehr! Ich mach gerade eine Herzdruckmassage, ich weiß nicht ob ich das richtig mache!',
      'Wie viele Personen sind betroffen?': 'Nur mein Mann, sonst ist niemand hier verletzt.',
      'Ist die Person ansprechbar?': 'Nein, er reagiert überhaupt nicht, egal was ich mache!',
      'Sind Sie selbst in Sicherheit?': 'Ja, mir geht es gut, ich hab nur furchtbare Angst um ihn.'
    },
    locationContexts: ['gebaeude']
  },
  {
    id: 'rd-verkehrsunfall',
    keyword: 'RD Verkehrsunfall',
    severity: 'hoch',
    requiredVehicleTypes: ['RTW', 'NEF'],
    summary: 'Auflahrunfall auf der Staatsstraße, zwei PKW beteiligt, eine Person klagt über Nackenschmerzen und sitzt noch im Fahrzeug.',
    callerStatement: 'Hier sind gerade zwei Autos ineinandergefahren, bitte kommen Sie schnell!',
    followUps: {
      'Was ist genau passiert?': 'Zwei Autos sind aufeinander aufgefahren, es hat ordentlich gekracht.',
      'Ist jemand verletzt oder in Gefahr?': 'Einer sitzt noch drin und hält sich den Nacken, ich glaub er kann nicht raus. Es qualmt zum Glück nicht oder so.',
      'Wie viele Personen sind betroffen?': 'Ich seh zwei Fahrer, einer steht schon draußen, dem anderen gehts nicht so gut.',
      'Ist die Person ansprechbar?': 'Ja, er redet, hält sich aber die ganze Zeit den Nacken.',
      'Sind Sie selbst in Sicherheit?': 'Ja, ich steh am Straßenrand, mir passiert nichts.'
    },
    locationContexts: ['strasse']
  },
  {
    id: 'rd-sturz-senior',
    keyword: 'RD Sturz mit Verletzung',
    severity: 'mittel',
    requiredVehicleTypes: ['RTW'],
    summary: 'Eine 84-jährige Frau ist im Badezimmer gestürzt und kann wegen starker Hüftschmerzen nicht mehr aufstehen, ist aber ansprechbar.',
    callerStatement: 'Ich bin gestürzt und komm nicht mehr hoch, könnten Sie bitte jemanden schicken?',
    followUps: {
      'Was ist genau passiert?': 'Ich bin im Bad ausgerutscht, die Hüfte tut furchtbar weh.',
      'Ist jemand verletzt oder in Gefahr?': 'Nur ich, sonst ist niemand hier, aber ich komm alleine nicht mehr hoch.',
      'Wie viele Personen sind betroffen?': 'Nur ich bin hier, ich wohne allein.',
      'Ist die Person ansprechbar?': 'Ja, ansprechen können Sie mich schon noch, keine Sorge, aber allein schaff ich das nicht.',
      'Sind Sie selbst in Sicherheit?': 'Ja, ich lieg einfach nur auf dem Boden und komm nicht hoch.'
    },
    locationContexts: ['gebaeude']
  },
  {
    id: 'rd-atemnot',
    keyword: 'RD Atemnot',
    severity: 'hoch',
    requiredVehicleTypes: ['RTW', 'NEF'],
    summary: 'Bekannter Asthmatiker (34) hat einen schweren Anfall, Lippen leicht bläulich verfärbt, Inhalator hilft nicht mehr ausreichend.',
    callerStatement: 'Mein Mitbewohner kriegt keine Luft mehr, bitte schnell!',
    followUps: {
      'Was ist genau passiert?': 'Er hat Asthma und sein Spray hilft nicht mehr wie sonst.',
      'Ist jemand verletzt oder in Gefahr?': 'Er wird schon ganz blau um den Mund, ich weiß nicht was ich noch machen soll!',
      'Wie viele Personen sind betroffen?': 'Nur mein Mitbewohner, ich bin selber okay.',
      'Ist die Person ansprechbar?': 'Ja noch, aber er kriegt kaum noch Worte raus.',
      'Sind Sie selbst in Sicherheit?': 'Ja, mir fehlt nichts.'
    },
    locationContexts: ['gebaeude']
  },
  {
    id: 'fw-kellerbrand',
    keyword: 'FW Kellerbrand',
    severity: 'hoch',
    requiredVehicleTypes: ['LF', 'ELW'],
    summary: 'Starke Rauchentwicklung aus dem Kellerfenster eines Mehrfamilienhauses, Bewohner der oberen Stockwerke sind noch im Gebäude.',
    callerStatement: 'Bei den Nachbarn qualmt es, bitte kommen Sie schnell!',
    followUps: {
      'Was ist genau passiert?': 'Aus dem Kellerfenster kommt richtig viel Rauch raus.',
      'Ist jemand verletzt oder in Gefahr?': 'Ich glaub da oben sind noch Leute in der Wohnung, die wissen bestimmt gar nichts davon!',
      'Wie viele Personen sind betroffen?': 'Keine Ahnung wie viele oben wohnen, aber da sind bestimmt mehrere Parteien im Haus.',
      'Ist die Person ansprechbar?': 'Ich hab noch niemanden direkt gesehen, nur den Rauch.',
      'Sind Sie selbst in Sicherheit?': 'Ja, ich steh hier draußen auf der Straße.'
    },
    locationContexts: ['gebaeude']
  },
  {
    id: 'fw-verkehrsunfall-eingeklemmt',
    keyword: 'FW Person eingeklemmt',
    severity: 'kritisch',
    requiredVehicleTypes: ['LF', 'RW', 'RTW'],
    summary: 'PKW gegen Baum geprallt, Fahrer ist im Fahrzeug eingeklemmt und ansprechbar, starke Schmerzen im Beinbereich.',
    callerStatement: 'Ein Auto ist gegen einen Baum gekracht, bitte kommen Sie schnell!',
    followUps: {
      'Was ist genau passiert?': 'Das Auto ist einfach von der Straße abgekommen und gegen den Baum gekracht.',
      'Ist jemand verletzt oder in Gefahr?': 'Der Fahrer kommt nicht mehr raus, das Bein ist irgendwie eingeklemmt, er schreit total vor Schmerzen!',
      'Wie viele Personen sind betroffen?': 'Ich seh nur den einen Fahrer im Auto.',
      'Ist die Person ansprechbar?': 'Ja, er redet noch mit mir.',
      'Sind Sie selbst in Sicherheit?': 'Ja, ich steh ein Stück weg vom Auto.'
    },
    locationContexts: ['strasse']
  },
  {
    id: 'fw-wasserschaden',
    keyword: 'FW Wasserrohrbruch',
    severity: 'niedrig',
    requiredVehicleTypes: ['LF'],
    summary: 'Wasserrohrbruch im Keller eines Einfamilienhauses, Wasser steht bereits knöcheltief, keine Personen gefährdet.',
    callerStatement: 'Bei mir ist ein Rohr geplatzt, könnten Sie mal jemanden vorbeischicken?',
    followUps: {
      'Was ist genau passiert?': 'Im Keller steht das Wasser schon ziemlich hoch.',
      'Ist jemand verletzt oder in Gefahr?': 'Nein, es eilt jetzt nicht lebensgefährlich.',
      'Wie viele Personen sind betroffen?': 'Niemand, es geht nur um den Keller.',
      'Ist die Person ansprechbar?': 'Mir geht es gut, mir ist nichts passiert.',
      'Sind Sie selbst in Sicherheit?': 'Ja klar, ich steh oben, nur der Keller ist nass.'
    },
    locationContexts: ['gebaeude']
  },
  {
    id: 'fw-hilfeleistung-tier',
    keyword: 'FW Tier in Notlage',
    severity: 'niedrig',
    requiredVehicleTypes: ['LF'],
    summary: 'Eine Katze sitzt seit Stunden auf einem hohen Baum fest und kommt nicht mehr allein herunter.',
    callerStatement: 'Es tut mir fast leid, dass ich anrufe, aber ich hab hier ein kleines Problem.',
    followUps: {
      'Was ist genau passiert?': 'Meine Katze sitzt seit Stunden oben im Baum und traut sich einfach nicht runter.',
      'Ist jemand verletzt oder in Gefahr?': 'Nein, nur meine Katze hat halt Angst, sonst ist niemand in Gefahr.',
      'Wie viele Personen sind betroffen?': 'Niemand, nur die Katze halt.',
      'Ist die Person ansprechbar?': 'Also ich bin ansprechbar, wenn Sie das meinen, mir geht es gut.',
      'Sind Sie selbst in Sicherheit?': 'Ja, mir passiert nichts, ich steh unten am Baum.'
    },
    locationContexts: ['strasse', 'wald']
  },
  {
    id: 'fw-waldbrand',
    keyword: 'FW Brand Wald',
    severity: 'mittel',
    requiredVehicleTypes: ['LF', 'TLF'],
    summary: 'Ein Wanderer hat Rauch und offene Flammen im Unterholz entdeckt, das Feuer breitet sich bei trockenem Laub langsam aus.',
    callerStatement: 'Ich war grad wandern und hab hier im Wald was Beunruhigendes gesehen.',
    followUps: {
      'Was ist genau passiert?': 'Ich seh Rauch und schon richtige Flammen im Unterholz, breitet sich langsam aus.',
      'Ist jemand verletzt oder in Gefahr?': 'Nein, ich hab sonst niemanden hier gesehen.',
      'Wie viele Personen sind betroffen?': 'Ich bin allein unterwegs, verletzt ist niemand.',
      'Ist die Person ansprechbar?': 'Mir geht es gut, ich bin nur vom Rauch etwas aufgeregt.',
      'Sind Sie selbst in Sicherheit?': 'Ja, ich hab mich schon etwas vom Feuer zurückgezogen.'
    },
    locationContexts: ['wald']
  },
  {
    id: 'rd-wanderunfall',
    keyword: 'RD Sturz im Wald',
    severity: 'mittel',
    requiredVehicleTypes: ['RTW'],
    summary: 'Ein Wanderer ist auf einem Waldweg über eine Wurzel gestolpert und hat sich vermutlich den Knöchel gebrochen, kann nicht mehr laufen.',
    callerStatement: 'Mein Wanderkollege ist gestürzt und kann nicht mehr laufen.',
    followUps: {
      'Was ist genau passiert?': 'Er ist über eine Wurzel gestolpert, der Knöchel ist schon ganz dick angeschwollen.',
      'Ist jemand verletzt oder in Gefahr?': 'Nur er hat sich verletzt, mir ist nichts passiert.',
      'Wie viele Personen sind betroffen?': 'Wir sind zu zweit unterwegs, nur er ist verletzt.',
      'Ist die Person ansprechbar?': 'Ja, er ist ansprechbar, tut aber wahnsinnig weh.',
      'Sind Sie selbst in Sicherheit?': 'Ja, mir geht es gut, ich bleib bei ihm.'
    },
    locationContexts: ['wald']
  },
  {
    id: 'rd-person-im-wasser',
    keyword: 'RD Person im Wasser',
    severity: 'hoch',
    requiredVehicleTypes: ['RTW', 'NEF'],
    summary: 'Ein Schwimmer ist beim Baden in Not geraten und wurde von Umstehenden bereits ans Ufer gebracht, hustet stark und ist unterkühlt.',
    callerStatement: 'Hier ist gerade jemand beim Schwimmen fast abgesoffen, bitte schnell!',
    followUps: {
      'Was ist genau passiert?': 'Er ist beim Schwimmen plötzlich untergegangen, wir haben ihn schnell rausgeholt.',
      'Ist jemand verletzt oder in Gefahr?': 'Wir haben ihn rausgezogen ans Ufer, er hustet total und zittert am ganzen Körper.',
      'Wie viele Personen sind betroffen?': 'Nur der eine Schwimmer, uns anderen ist nichts passiert.',
      'Ist die Person ansprechbar?': 'Ja, er ist ansprechbar, aber ganz durcheinander.',
      'Sind Sie selbst in Sicherheit?': 'Ja, wir sind alle am Ufer, uns geht es gut.'
    },
    locationContexts: ['wasser']
  }
]
